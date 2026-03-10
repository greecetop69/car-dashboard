import { mapKcar, type CarPhoto, type ParsedCarRecord, type ParsedCarsResponse } from "./carSources.js";
import { fetchWithTimeout } from "./http.js";

interface KcarRow {
  carCd?: string;
  prdcnYr?: string | number;
  milg?: string | number;
  prc?: string | number;
  dcPrc?: string | number;
  lsizeImgPath?: string;
  msizeImgPath?: string;
  ssizeImgPath?: string;
  modelNm?: string;
  grdNm?: string;
  grdDtlNm?: string;
  mfgDt?: string;
  acdtHistCd?: string;
  acdtHistCnts?: string;
}

interface KcarListPayload {
  data?: {
    rows?: KcarRow[];
  };
}

interface KcarDetailPayload {
  data?: {
    avo?: {
      salprc?: number | string;
      wklyDcPrc?: number | string | null;
      milg?: number | string;
      regModelyr?: number | string;
      acdtHistComnt?: string | null;
      owncarDmgeAcdtCnt?: number | string | null;
      lsizeImgPath?: string | null;
      msizeImgPath?: string | null;
      ssizeImgPath?: string | null;
      grdNm?: string | null;
      grdDtlNm?: string | null;
      modelNm?: string | null;
    };
  };
}

const KCAR_LIST_URL = "https://api.kcar.com/bc/search/list/drct";
const KCAR_DETAIL_URL = "https://api.kcar.com/bc/mma/info";
const KCAR_TIMEOUT_MS = 20000;
const KCAR_DETAIL_TIMEOUT_MS = 12000;
const KCAR_MAX_PRICE_WON = 13000000;
const KCAR_DETAIL_ENABLED = true;
const KCAR_HEADERS = {
  Accept: "application/json",
  "Content-Type": "application/json;charset=UTF-8",
  Origin: "https://www.kcar.com",
  Referer: "https://www.kcar.com/",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36",
};

const DEFAULT_KCAR_ENC =
  "gEa/4VFh8fIVdgV57tSPeo5wnLj8tR9ZXOBi0F2lGHmF+ixSw7TWnjEHz0DkNHnT1bcDauIelKkX9mmN8NFcznKoVRxlbMUe1uUDLmIyeKAd/L8CsCfV+e2cER2JXsvWqnLlzZ+X0waWoKV3sUX+VlZ2tomRsG42B0C+xgm50I5El87tlE5WdkGSailmUjpZWvfIYUYIWG+4JKawbgtydSlItw/6DTEEdwbs/OmrTlQO/ogfQkOMLejEerZEiGgx+75+e2Mi9hr2V9mL9s0Kfnxgo1TJofjT/DYqSYl1V1sBlTVcsimPoIMVryl0KWRwIkXXImJaRoxhmJUvu/+mPIwdfRmFr/FRzfNItuq2MXWB9s8YzXtYen+MkFMS5sZbA69XULzPbBEjIr6FXMIUPg==";

function parseNumeric(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^\d.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function parseYear(value: unknown) {
  const raw = String(value ?? "").trim();
  const match = raw.match(/\d{4}/);
  if (!match) return 0;
  const year = Number(match[0]);
  return Number.isInteger(year) ? year : 0;
}

function toModifiedDate(row: KcarRow) {
  const mfg = String(row.mfgDt ?? "").trim();
  if (/^\d{6}$/.test(mfg)) {
    const year = mfg.slice(0, 4);
    const month = mfg.slice(4, 6);
    return `01.${month}.${year}, 00:00:00`;
  }
  return "";
}

function normalizeInspectionCondition(row: KcarRow): "clean" | "repair" | null {
  const code = String(row.acdtHistCd ?? "").trim();
  const text = String(row.acdtHistCnts ?? "").trim();
  if (text.includes("무사고")) return "clean";
  if (code === "100") return "clean";
  if (code.length > 0 || text.length > 0) return "repair";
  return null;
}

function normalizeDetailInspectionCondition(
  acdtHistComnt: string | null | undefined,
  owncarDmgeAcdtCnt: number,
): "clean" | "repair" | null {
  const text = String(acdtHistComnt ?? "").trim();
  if (text.includes("무사고")) return "clean";
  if (text.length > 0) return "repair";
  if (Number.isFinite(owncarDmgeAcdtCnt)) {
    return owncarDmgeAcdtCnt > 0 ? "repair" : "clean";
  }
  return null;
}

function buildBadge(parts: Array<string | null | undefined>) {
  return parts
    .map((item) => String(item ?? "").trim())
    .filter(Boolean)
    .join(" ");
}

const detailCache = new Map<
  string,
  {
    priceWon?: number;
    discountPriceWon?: number;
    mileageKm?: number;
    year?: number;
    inspectionCondition?: "clean" | "repair" | null;
    mainPhoto?: string | null;
    badge?: string;
  }
>();

async function fetchKcarDetail(sourceId: string) {
  if (!sourceId) return null;
  const cached = detailCache.get(sourceId);
  if (cached) return cached;

  const response = await fetchWithTimeout(
    KCAR_DETAIL_URL,
    {
      method: "POST",
      headers: KCAR_HEADERS,
      body: JSON.stringify({
        i_sCarCd: sourceId,
        a_ThemeNm: "none",
        a_leaseFlag: "N",
      }),
    },
    KCAR_DETAIL_TIMEOUT_MS,
  );
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} while fetching kcar detail (${sourceId})`);
  }

  const payload = (await response.json()) as KcarDetailPayload;
  const avo = payload.data?.avo;
  if (!avo) {
    detailCache.set(sourceId, {});
    return {};
  }

  const owncarDmgeAcdtCnt = Math.max(0, Math.trunc(parseNumeric(avo.owncarDmgeAcdtCnt)));
  const detail = {
    priceWon: Math.max(0, Math.trunc(parseNumeric(avo.salprc))),
    discountPriceWon: Math.max(0, Math.trunc(parseNumeric(avo.wklyDcPrc) * 10000)),
    mileageKm: Math.max(0, Math.trunc(parseNumeric(avo.milg))),
    year: parseYear(avo.regModelyr),
    inspectionCondition: normalizeDetailInspectionCondition(
      avo.acdtHistComnt,
      owncarDmgeAcdtCnt,
    ),
    mainPhoto: avo.lsizeImgPath || avo.msizeImgPath || avo.ssizeImgPath || null,
    badge: buildBadge([avo.modelNm, avo.grdNm, avo.grdDtlNm]),
  };

  detailCache.set(sourceId, detail);
  return detail;
}

async function normalizeRow(row: KcarRow): Promise<ParsedCarRecord | null> {
  const sourceId = String(row.carCd ?? "").trim();
  if (!sourceId) return null;

  const listYear = parseYear(row.prdcnYr);
  const listMileageKm = Math.max(0, Math.trunc(parseNumeric(row.milg)));
  const listBasePriceManWon = parseNumeric(row.prc);
  const listDiscountPriceManWon = parseNumeric(row.dcPrc);
  const listBasePriceWon = Math.max(0, Math.trunc(listBasePriceManWon * 10000));
  const listDiscountPriceWon = Math.max(0, Math.trunc(listDiscountPriceManWon * 10000));
  const listPriceWon =
    listDiscountPriceWon > 0 && listDiscountPriceWon < listBasePriceWon
      ? listDiscountPriceWon
      : listBasePriceWon;
  let year = listYear;
  let mileageKm = listMileageKm;
  let priceWon = listPriceWon;
  if (priceWon <= 0 || (KCAR_MAX_PRICE_WON > 0 && priceWon > KCAR_MAX_PRICE_WON)) return null;

  let badge = buildBadge([row.modelNm, row.grdNm, row.grdDtlNm]);
  let mainPhoto = row.lsizeImgPath || row.msizeImgPath || row.ssizeImgPath || null;
  const photos: CarPhoto[] = mainPhoto
    ? [{ type: "001", location: mainPhoto, updatedDate: "", ordering: 1 }]
    : [];
  let inspectionCondition = normalizeInspectionCondition(row);

  if (KCAR_DETAIL_ENABLED) {
    try {
      const detail = await fetchKcarDetail(sourceId);
      if (detail) {
        const detailPriceWon = detail.priceWon;
        const detailDiscountPriceWon = detail.discountPriceWon;
        const effectiveDetailPriceWon =
          typeof detailDiscountPriceWon === "number" &&
          Number.isFinite(detailDiscountPriceWon) &&
          detailDiscountPriceWon > 0 &&
          typeof detailPriceWon === "number" &&
          Number.isFinite(detailPriceWon) &&
          detailDiscountPriceWon < detailPriceWon
            ? detailDiscountPriceWon
            : detailPriceWon;
        if (
          typeof effectiveDetailPriceWon === "number" &&
          Number.isFinite(effectiveDetailPriceWon) &&
          effectiveDetailPriceWon > 0
        ) {
          priceWon = effectiveDetailPriceWon;
        }
        const detailMileageKm = detail.mileageKm;
        if (typeof detailMileageKm === "number" && Number.isFinite(detailMileageKm) && detailMileageKm > 0) {
          mileageKm = detailMileageKm;
        }
        const detailYear = detail.year;
        if (typeof detailYear === "number" && Number.isFinite(detailYear) && detailYear > 0) {
          year = detailYear;
        }
        if (typeof detail.inspectionCondition !== "undefined") {
          inspectionCondition = detail.inspectionCondition ?? null;
        }
        if (detail.mainPhoto) {
          mainPhoto = detail.mainPhoto;
        }
        if (detail.badge) {
          badge = detail.badge;
        }
      }
    } catch {
      // keep list data when detail endpoint is temporarily unavailable
    }
  }

  if (KCAR_MAX_PRICE_WON > 0 && priceWon > KCAR_MAX_PRICE_WON) {
    return null;
  }

  return mapKcar({
    sourceId,
    year,
    mileageKm,
    priceWon,
    mainPhoto,
    photos,
    badge,
    modifiedDate: toModifiedDate(row),
    inspectionCondition,
  });
}

export async function fetchKcarCars(): Promise<ParsedCarsResponse> {
  const enc = process.env.KCAR_ENC_PAYLOAD?.trim() || DEFAULT_KCAR_ENC;
  const response = await fetchWithTimeout(
    KCAR_LIST_URL,
    {
      method: "POST",
      headers: KCAR_HEADERS,
      body: JSON.stringify({ enc }),
    },
    KCAR_TIMEOUT_MS,
  );

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} while fetching kcar cars`);
  }

  const payload = (await response.json()) as KcarListPayload;
  const rows = payload.data?.rows ?? [];
  const cars: ParsedCarRecord[] = [];
  for (const row of rows) {
    const normalized = await normalizeRow(row);
    if (normalized) cars.push(normalized);
  }

  return {
    cars,
    updatedAt: new Date().toISOString(),
  };
}
