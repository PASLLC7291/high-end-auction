/**
 * CJ Dropshipping API Client
 *
 * Typed wrapper for CJ Dropshipping's V2 API.
 * Handles authentication, token refresh, product search, inventory,
 * freight calculation, order creation, payment, and tracking.
 *
 * Base URL: https://developers.cjdropshipping.com/api2.0/v1
 * Auth: CJ-Access-Token header (obtained via API key exchange)
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve } from "path";

const CJ_BASE_URL = "https://developers.cjdropshipping.com/api2.0/v1";

// Token is persisted here so we don't re-auth on every script/server restart.
// getAccessToken is rate-limited to 1 call per 5 minutes, but the token lasts
// 15 days and the refresh token lasts 180 days.
const TOKEN_FILE = resolve(process.cwd(), ".cj-token.json");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CJResponse<T> = {
  code: number;
  result: boolean;
  message: string;
  data: T;
  requestId: string;
};

export type CJTokenData = {
  openId: string;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiryDate: string;
  refreshTokenExpiryDate: string;
  createDate: string;
};

export type CJProductVariant = {
  vid: string;
  pid: string;
  variantName: string | null;
  variantNameEn: string;
  variantSku: string;
  variantProperty: string | null;
  variantKey: string;
  variantLength: number;
  variantWidth: number;
  variantHeight: number;
  variantVolume: number;
  variantWeight: number;
  variantSellPrice: number;
  variantSugSellPrice: number;
  variantImage?: string;
  variantUnit?: string | null;
  variantStandard?: string;
  createTime?: number;
};

// Product from the detail endpoint (/product/query)
export type CJProduct = {
  pid: string;
  productName: string;
  productNameEn: string;
  productSku: string;
  productImage: string; // JSON array string e.g. '["url1","url2"]'
  productImageSet: string[];
  productWeight: string; // string like "100.0"
  productUnit: string;
  productType: string;
  categoryId: string;
  categoryName: string;
  entryCode: string;
  entryNameEn: string;
  materialNameEn: string;
  sellPrice: string; // range string e.g. "8.7-10.19"
  description?: string;
  variants?: CJProductVariant[];
  suggestSellPrice?: string;
  listedNum?: number;
  status?: string;
};

// Product from the search/list endpoint — lighter shape
export type CJSearchProduct = {
  id: string; // same as pid in detail
  nameEn: string;
  sku: string;
  bigImage: string;
  sellPrice: string; // "8.7 -- 10.19" or "1.65"
  categoryId: string;
  listedNum: number;
  warehouseInventoryNum: number;
  productType: string;
  myProduct: boolean;
  isVideo: number;
  videoList: unknown[];
};

// Raw shape returned by /product/listV2
type CJSearchContent = {
  productList: CJSearchProduct[];
  relatedCategoryList: unknown[];
  keyWord: string;
  keyWordOld: string | null;
};

type CJSearchRawData = {
  pageSize: number;
  pageNumber: number;
  totalRecords: number;
  totalPages: number;
  content: CJSearchContent[];
};

// Normalised result returned by our searchProducts()
export type CJProductListResult = {
  pageNumber: number;
  pageSize: number;
  totalRecords: number;
  totalPages: number;
  products: CJSearchProduct[];
};

// Inventory from /product/stock/getInventoryByPid
export type CJInventoryByPid = {
  inventories: Array<{
    areaEn: string;
    areaId: number;
    countryCode: string;
    totalInventoryNum: number;
    cjInventoryNum: number;
    factoryInventoryNum: number;
    countryNameEn: string;
  }>;
  variantInventories: Array<{
    vid: string;
    inventory: Array<{
      countryCode: string;
      totalInventory: number;
      cjInventory: number;
      factoryInventory: number;
      verifiedWarehouse: number;
    }>;
  }>;
};

// Inventory from /product/stock/queryByVid
export type CJInventoryItem = {
  vid: string;
  areaId: string;
  areaEn: string;
  countryCode: string;
  storageNum: number;
  totalInventoryNum: number;
  cjInventoryNum: number;
  factoryInventoryNum: number;
};

export type CJFreightOption = {
  logisticName: string;
  logisticPrice: number;
  logisticPriceCn: number;
  logisticAging: string;
  taxesFee: number;
  clearanceOperationFee: number;
  totalPostageFee: number;
};

export type CJOrderProduct = {
  vid: string;
  quantity: number;
  unitPrice?: number;
};

export type CJOrderResult = {
  orderId: string;
  orderNumber: string;
  orderAmount: number;
  orderStatus: string;
};

export type CJOrderDetail = {
  orderId: string;
  orderNumber: string;
  orderStatus: string;
  orderAmount: number;
  trackNumber?: string;
  logisticName?: string;
};

export type CJTrackInfo = {
  trackingNumber: string;
  logisticName: string;
  trackingFrom: string;
  trackingTo: string;
  trackingStatus: string;
  deliveryDay: number;
  deliveryTime?: string;
  lastMileCarrier?: string;
  lastTrackNumber?: string;
};

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export class CJClient {
  private accessToken: string | null = null;
  private refreshTokenValue: string | null = null;
  private refreshTokenExpiry: Date | null = null;
  private tokenExpiry: Date | null = null;
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.loadPersistedToken();
  }

  // -- Token persistence --------------------------------------------------

  private loadPersistedToken(): void {
    try {
      if (!existsSync(TOKEN_FILE)) return;
      const raw = readFileSync(TOKEN_FILE, "utf-8");
      const data = JSON.parse(raw) as CJTokenData;

      const expiry = new Date(data.accessTokenExpiryDate);
      const refreshExpiry = new Date(data.refreshTokenExpiryDate);

      // Token still valid (with 1-hour buffer)?
      if (expiry > new Date(Date.now() + 60 * 60 * 1000)) {
        this.accessToken = data.accessToken;
        this.refreshTokenValue = data.refreshToken;
        this.tokenExpiry = expiry;
        this.refreshTokenExpiry = refreshExpiry;
        console.log(
          `[cj-client] Loaded persisted token (expires ${expiry.toISOString()})`
        );
        return;
      }

      // Access token expired but refresh token still valid?
      if (refreshExpiry > new Date()) {
        this.refreshTokenValue = data.refreshToken;
        this.refreshTokenExpiry = refreshExpiry;
        console.log(
          "[cj-client] Access token expired, will use refresh token"
        );
      }
    } catch {
      // Corrupt file — ignore, will re-auth
    }
  }

  private persistToken(data: CJTokenData): void {
    try {
      writeFileSync(TOKEN_FILE, JSON.stringify(data, null, 2));
    } catch (e) {
      console.warn("[cj-client] Failed to persist token:", e);
    }
  }

  // -- Internal helpers ---------------------------------------------------

  private async request<T>(
    method: "GET" | "POST" | "PATCH" | "DELETE",
    path: string,
    options?: {
      body?: Record<string, unknown>;
      params?: Record<string, string | number | boolean | undefined>;
      skipAuth?: boolean;
    }
  ): Promise<CJResponse<T>> {
    if (!options?.skipAuth) {
      await this.ensureAuthenticated();
    }

    const url = new URL(`${CJ_BASE_URL}${path}`);
    if (options?.params) {
      for (const [key, value] of Object.entries(options.params)) {
        if (value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      }
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.accessToken && !options?.skipAuth) {
      headers["CJ-Access-Token"] = this.accessToken;
    }

    const response = await fetch(url.toString(), {
      method,
      headers,
      body: options?.body ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      throw new Error(
        `CJ API error: ${response.status} ${response.statusText}`
      );
    }

    const data = (await response.json()) as CJResponse<T>;
    if (data.code !== 200) {
      throw new Error(`CJ API error ${data.code}: ${data.message}`);
    }

    return data;
  }

  private async ensureAuthenticated(): Promise<void> {
    // Valid access token (with 1-hour buffer)?
    if (
      this.accessToken &&
      this.tokenExpiry &&
      this.tokenExpiry > new Date(Date.now() + 60 * 60 * 1000)
    ) {
      return;
    }

    // Try refresh first (5 calls/min limit — very generous)
    if (
      this.refreshTokenValue &&
      this.refreshTokenExpiry &&
      this.refreshTokenExpiry > new Date()
    ) {
      try {
        await this.doRefreshToken();
        return;
      } catch {
        // Fall through to full auth
      }
    }

    // Full auth (1 call per 5 min — only needed every 15 days)
    await this.authenticate();
  }

  // -- Authentication -----------------------------------------------------

  async authenticate(): Promise<CJTokenData> {
    const response = await this.request<CJTokenData>(
      "POST",
      "/authentication/getAccessToken",
      {
        body: { apiKey: this.apiKey },
        skipAuth: true,
      }
    );

    this.accessToken = response.data.accessToken;
    this.refreshTokenValue = response.data.refreshToken;
    this.tokenExpiry = new Date(response.data.accessTokenExpiryDate);
    this.refreshTokenExpiry = new Date(response.data.refreshTokenExpiryDate);
    this.persistToken(response.data);

    return response.data;
  }

  private async doRefreshToken(): Promise<CJTokenData> {
    if (!this.refreshTokenValue) {
      throw new Error("No refresh token available");
    }

    const response = await this.request<CJTokenData>(
      "POST",
      "/authentication/refreshAccessToken",
      {
        body: { refreshToken: this.refreshTokenValue },
        skipAuth: true,
      }
    );

    this.accessToken = response.data.accessToken;
    this.refreshTokenValue = response.data.refreshToken;
    this.tokenExpiry = new Date(response.data.accessTokenExpiryDate);
    this.refreshTokenExpiry = new Date(response.data.refreshTokenExpiryDate);
    this.persistToken(response.data);

    return response.data;
  }

  async refreshAccessToken(): Promise<CJTokenData> {
    return this.doRefreshToken();
  }

  // -- Product Catalog ----------------------------------------------------

  async searchProducts(params: {
    keyWord?: string;
    categoryId?: string;
    page?: number;
    size?: number;
    countryCode?: string;
    startSellPrice?: number;
    endSellPrice?: number;
    orderBy?: number; // 0=match, 1=listings, 2=price, 3=date, 4=inventory
    sort?: "asc" | "desc";
  }): Promise<CJProductListResult> {
    // listV2 returns { content: [{ productList: [...] }], pageNumber, ... }
    const response = await this.request<CJSearchRawData>(
      "GET",
      "/product/listV2",
      {
        params: {
          keyWord: params.keyWord,
          categoryId: params.categoryId,
          page: params.page ?? 1,
          size: params.size ?? 20,
          countryCode: params.countryCode,
          startSellPrice: params.startSellPrice,
          endSellPrice: params.endSellPrice,
          orderBy: params.orderBy,
          sort: params.sort,
        },
      }
    );

    const raw = response.data;
    return {
      pageNumber: raw.pageNumber,
      pageSize: raw.pageSize,
      totalRecords: raw.totalRecords,
      totalPages: raw.totalPages,
      products: raw.content?.[0]?.productList ?? [],
    };
  }

  async getProduct(params: {
    pid?: string;
    productSku?: string;
    variantSku?: string;
  }): Promise<CJProduct> {
    const response = await this.request<CJProduct>("GET", "/product/query", {
      params: {
        pid: params.pid,
        productSku: params.productSku,
        variantSku: params.variantSku,
        "features[]": "enable_description",
      },
    });

    return response.data;
  }

  async getVariants(params: {
    pid?: string;
    productSku?: string;
    countryCode?: string;
  }): Promise<CJProductVariant[]> {
    const response = await this.request<CJProductVariant[]>(
      "GET",
      "/product/variant/query",
      {
        params: {
          pid: params.pid,
          productSku: params.productSku,
          countryCode: params.countryCode,
        },
      }
    );

    return response.data;
  }

  // -- Inventory ----------------------------------------------------------

  async getInventoryByVariant(vid: string): Promise<CJInventoryItem[]> {
    const response = await this.request<CJInventoryItem[]>(
      "GET",
      "/product/stock/queryByVid",
      { params: { vid } }
    );

    return response.data;
  }

  async getInventoryByProduct(pid: string): Promise<CJInventoryByPid> {
    const response = await this.request<CJInventoryByPid>(
      "GET",
      "/product/stock/getInventoryByPid",
      { params: { pid } }
    );

    return response.data;
  }

  // -- Freight Calculation ------------------------------------------------

  async calculateFreight(params: {
    startCountryCode: string;
    endCountryCode: string;
    products: Array<{ vid: string; quantity: number }>;
    zip?: string;
  }): Promise<CJFreightOption[]> {
    const response = await this.request<CJFreightOption[]>(
      "POST",
      "/logistic/freightCalculate",
      {
        body: {
          startCountryCode: params.startCountryCode,
          endCountryCode: params.endCountryCode,
          products: params.products,
          zip: params.zip,
        },
      }
    );

    return response.data;
  }

  // -- Order Management ---------------------------------------------------

  async createOrder(params: {
    orderNumber: string;
    shippingCountryCode: string;
    shippingCustomerName: string;
    shippingAddress: string;
    shippingCity: string;
    shippingProvince: string;
    shippingZip?: string;
    shippingPhone?: string;
    logisticName: string;
    fromCountryCode: string;
    products: CJOrderProduct[];
  }): Promise<CJOrderResult> {
    const response = await this.request<CJOrderResult>(
      "POST",
      "/shopping/order/createOrderV2",
      {
        body: {
          orderNumber: params.orderNumber,
          shippingCountryCode: params.shippingCountryCode,
          shippingCustomerName: params.shippingCustomerName,
          shippingAddress: params.shippingAddress,
          shippingCity: params.shippingCity,
          shippingProvince: params.shippingProvince,
          shippingZip: params.shippingZip,
          shippingPhone: params.shippingPhone,
          logisticName: params.logisticName,
          fromCountryCode: params.fromCountryCode,
          payType: 2, // balance payment
          products: params.products,
        },
      }
    );

    return response.data;
  }

  async payOrder(orderId: string): Promise<void> {
    await this.request("POST", "/shopping/pay/payBalance", {
      body: { orderId },
    });
  }

  async confirmOrder(orderId: string): Promise<void> {
    await this.request("PATCH", "/shopping/order/confirmOrder", {
      params: { orderId },
    });
  }

  async getOrderDetail(orderId: string): Promise<CJOrderDetail> {
    const response = await this.request<CJOrderDetail>(
      "GET",
      "/shopping/order/getOrderDetail",
      { params: { orderId } }
    );

    return response.data;
  }

  async getBalance(): Promise<{ amount: number; freezeAmount: number }> {
    const response = await this.request<{
      amount: number;
      noWithdrawalAmount: number;
      freezeAmount: number;
    }>("GET", "/shopping/pay/getBalance");

    return {
      amount: response.data.amount,
      freezeAmount: response.data.freezeAmount,
    };
  }

  // -- Tracking -----------------------------------------------------------

  async getTracking(trackNumber: string): Promise<CJTrackInfo> {
    const response = await this.request<CJTrackInfo>(
      "GET",
      "/logistic/trackInfo",
      { params: { trackNumber } }
    );

    return response.data;
  }

  // -- Webhooks -----------------------------------------------------------

  // -- Account Settings / Quotas ------------------------------------------

  async getSettings(): Promise<Record<string, unknown>> {
    const response = await this.request<Record<string, unknown>>(
      "GET",
      "/setting/get"
    );
    return response.data;
  }

  async configureWebhooks(params: {
    orderCallbackUrl?: string;
    logisticsCallbackUrl?: string;
    productCallbackUrl?: string;
    stockCallbackUrl?: string;
  }): Promise<void> {
    const body: Record<string, { type: string; callbackUrls: string[] }> = {};

    if (params.orderCallbackUrl) {
      body.order = {
        type: "ENABLE",
        callbackUrls: [params.orderCallbackUrl],
      };
    }
    if (params.logisticsCallbackUrl) {
      body.logistics = {
        type: "ENABLE",
        callbackUrls: [params.logisticsCallbackUrl],
      };
    }
    if (params.productCallbackUrl) {
      body.product = {
        type: "ENABLE",
        callbackUrls: [params.productCallbackUrl],
      };
    }
    if (params.stockCallbackUrl) {
      body.stock = {
        type: "ENABLE",
        callbackUrls: [params.stockCallbackUrl],
      };
    }

    await this.request("POST", "/webhook/set", { body });
  }
}

// ---------------------------------------------------------------------------
// Singleton factory
// ---------------------------------------------------------------------------

let clientInstance: CJClient | null = null;

export function getCJClient(): CJClient {
  if (!clientInstance) {
    const apiKey = process.env.CJ_API_KEY?.trim();
    if (!apiKey) {
      throw new Error("Missing CJ_API_KEY environment variable");
    }
    clientInstance = new CJClient(apiKey);
  }
  return clientInstance;
}
