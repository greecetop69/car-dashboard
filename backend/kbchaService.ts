import { mapKbcha, type CarPhoto, type ParsedCarRecord, type ParsedCarsResponse } from "./carSources.js";

interface KbSearchHit {
  carSeq?: number;
  fileNameArray?: string[];
  carAccidentNo?: number;
  yymm?: number | string;
  regiDay?: string;
  km?: number;
  sellAmt?: number;
  orderDate?: string;
  modelName?: string;
  gradeName?: string;
}

interface KbSearchResponse {
  status?: number;
  result?: {
    hits?: KbSearchHit[];
    searchAfter?: Array<string | number | null>;
  };
}

const KB_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36",
  Referer: "https://m.kbchachacha.com/",
  Origin: "https://m.kbchachacha.com",
  Accept: "application/json",
};

const KB_SEARCH_BASE_URL = "https://m.kbchachacha.com/public/web/search/infinitySearch.json";
const KB_IMAGE_SHARDS = Array.from({ length: 31 }, (_, idx) => String(idx).padStart(2, "0"));
const kbShardByGroup = new Map<string, string>();

function parseYear(hit: KbSearchHit) {
  if (typeof hit.yymm === "number") return hit.yymm;
  if (typeof hit.yymm === "string" && hit.yymm.length >= 4) {
    const parsed = Number(hit.yymm.slice(0, 4));
    if (Number.isInteger(parsed)) return parsed;
  }
  if (typeof hit.regiDay === "string" && hit.regiDay.length >= 4) {
    const parsed = Number(hit.regiDay.slice(0, 4));
    if (Number.isInteger(parsed)) return parsed;
  }
  return 0;
}

function toKishinevTime(raw?: string) {
  if (!raw) return "";
  const iso = raw.includes("T") ? raw : raw.replace(" ", "T");
  const withOffset = /[+-]\d{2}:\d{2}$/.test(iso) ? iso : `${iso}+09:00`;
  const date = new Date(withOffset);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleString("ru-RU", { timeZone: "Europe/Chisinau" });
}

function buildKbSearchUrl(searchAfter: string) {
  const params = new URLSearchParams({
    makerCode: "109",
    classCode: "1941",
    carCode: "1552",
    regiDay: "2017,2020",
    sort: "-hasOverThreeFileNames,diagOrKbCertifiedOrPremiumYn,-paymentPlayYn,-homeserviceYn2,-orderDate",
    page: "1",
    pageSize: "50",
    includeFields:
      "carSeq,fileNameArray,ownerYn,makerName,className,carName,modelName,gradeName,regiDay,yymm,km,cityCodeName2,sellAmtGbn,sellAmt,sellAmtPrev,carMasterSpecialYn,monthLeaseAmt,interestFreeYn,ownerYn,directYn,carAccidentNo,warrantyYn,falsityYn,kbLeaseYn,friendDealerYn,orderDate,certifiedShopYn,kbCertifiedYn,hasOverThreeFileNames,diagYn,diagGbn,lineAdYn,tbMemberMemberName,carAccidentNo,colorCodeName,gasName,safeTel,carHistorySeq,homeserviceYn2,labsDanjiNo2,premiumYn,premiumVideo,premiumVideoType,premiumVideoImage,t34SellGbn,t34MonthAmt,t34DiscountAmt,adState,shopPenaltyYn,paymentPremiumYn,paymentPremiumText,paymentPremiumMarkCdArray,paymentPremiumMarkNmArray,contractingYn,partnerCertifiedYn,seatColorCode,seatColorNm,paymentPlayYn",
    displaySoldoutYn: "Y",
    v: String(Date.now()),
    searchAfter,
  });
  return `${KB_SEARCH_BASE_URL}?${params.toString()}`;
}

function makeKbPhotoUrl(sourceId: string, fileName: string, shard: string) {
  const group = sourceId.slice(0, 4);
  return `https://img.kbchachacha.com/IMG/carimg/l/img${shard}/img${group}/${fileName}?width=720`;
}

async function resolveKbShard(sourceId: string, firstFileName: string) {
  const group = sourceId.slice(0, 4);
  const cachedShard = kbShardByGroup.get(group);
  if (cachedShard) {
    const cachedUrl = makeKbPhotoUrl(sourceId, firstFileName, cachedShard);
    try {
      const cachedResponse = await fetch(cachedUrl, { method: "HEAD" });
      if (cachedResponse.ok) return cachedShard;
    } catch {
      // fallback to full scan
    }
  }

  for (const shard of KB_IMAGE_SHARDS) {
    const candidate = makeKbPhotoUrl(sourceId, firstFileName, shard);
    try {
      const response = await fetch(candidate, { method: "HEAD" });
      if (response.ok) {
        kbShardByGroup.set(group, shard);
        return shard;
      }
    } catch {
      // try next shard
    }
  }
  return null;
}

async function normalizeHit(hit: KbSearchHit): Promise<ParsedCarRecord | null> {
  const sourceId = String(hit.carSeq ?? "").trim();
  if (!sourceId) return null;

  const year = parseYear(hit);
  const mileageKm = Number(hit.km ?? 0);
  const sellAmt = Number(hit.sellAmt ?? 0);
  const accidentCountRaw = Number(hit.carAccidentNo);
  const accidentCount = Number.isFinite(accidentCountRaw) ? accidentCountRaw : null;
  const model = hit.modelName?.trim();
  const grade = hit.gradeName?.trim();
  const badge = [model, grade].filter(Boolean).join(" ");
  const fileNames = (hit.fileNameArray ?? []).filter((item) => typeof item === "string" && item.length > 0);
  const firstFileName = fileNames[0] ?? null;
  const resolvedShard = firstFileName ? await resolveKbShard(sourceId, firstFileName) : null;
  const photos: CarPhoto[] =
    resolvedShard == null
      ? []
      : fileNames.map((fileName, idx) => ({
          type: String(idx + 1).padStart(3, "0"),
          location: makeKbPhotoUrl(sourceId, fileName, resolvedShard),
          updatedDate: "",
          ordering: idx + 1,
        }));
  const firstPhoto = photos[0] ?? null;

  return mapKbcha({
    sourceId,
    year: Number.isFinite(year) ? year : 0,
    mileageKm: Number.isFinite(mileageKm) ? mileageKm : 0,
    sellAmt,
    accidentCount,
    mainPhoto: firstPhoto?.location ?? null,
    photos: firstPhoto ? [firstPhoto] : [],
    badge,
    modifiedDate: toKishinevTime(hit.orderDate),
  });
}

export async function fetchKbchaCars(): Promise<ParsedCarsResponse> {
  const cars: ParsedCarRecord[] = [];
  let searchAfter = "";

  for (let page = 0; page < 30; page += 1) {
    const response = await fetch(buildKbSearchUrl(searchAfter), {
      headers: KB_HEADERS,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} while fetching kbcha cars`);
    }

    const payload = (await response.json()) as KbSearchResponse;
    const hits = payload.result?.hits ?? [];
    if (hits.length === 0) break;

    for (const hit of hits) {
      const normalized = await normalizeHit(hit);
      if (normalized) cars.push(normalized);
    }

    const nextSearchAfter = (payload.result?.searchAfter ?? [])
      .filter((v) => v != null)
      .map((v) => String(v))
      .join(",");

    if (!nextSearchAfter || nextSearchAfter === searchAfter) break;
    searchAfter = nextSearchAfter;
  }

  return {
    cars,
    updatedAt: new Date().toISOString(),
  };
}
