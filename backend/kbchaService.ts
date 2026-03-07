import { mapKbcha, type CarPhoto, type ParsedCarRecord, type ParsedCarsResponse } from "./carSources.js";
import { fetchWithTimeout } from "./http.js";

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
  contractingYn?: string;
  adState?: string;
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
  Referer: "https://www.kbchachacha.com/",
  Origin: "https://www.kbchachacha.com",
  Accept: "application/json",
};

const KB_SEARCH_ENDPOINTS: readonly string[] = [
  "https://www.kbchachacha.com/public/web/search/infinitySearch.json",
  "https://www.kbchachacha.com/public/web/search/infinitySearch.kbc",
  "https://www.kbchachacha.com/public/search/infinitySearch.json",
  "https://www.kbchachacha.com/public/search/infinitySearch.kbc",
];
const KB_LIST_BASE_URL = "https://www.kbchachacha.com/public/search/list.empty";
const SEARCH_TIMEOUT_MS = 15000;
const KB_MIN_YEAR = 2017;
const KB_MAX_YEAR = 2020;
const KB_MAX_KM = 130000;
const KB_MAX_PRICE_WON = 14500000;
const KB_MAX_PRICE_MANWON = Math.floor(KB_MAX_PRICE_WON / 10000);
const ACTIVE_AD_STATES = new Set(["030160"]);

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
  const withOffset = /(?:[+-]\d{2}:\d{2}|Z)$/i.test(iso) ? iso : `${iso}+09:00`;
  const date = new Date(withOffset);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleString("ru-RU", { timeZone: "Europe/Chisinau" });
}

function buildKbSearchUrl(baseUrl: string, searchAfter: string) {
  const params = new URLSearchParams({
    makerCode: "109",
    classCode: "1941",
    carCode: "1552",
    km: `,${KB_MAX_KM}`,
    regiDay: `${KB_MIN_YEAR},${KB_MAX_YEAR}`,
    sellAmt: `,${KB_MAX_PRICE_MANWON}`,
    sort: "-hasOverThreeFileNames,diagOrKbCertifiedOrPremiumYn,-paymentPlayYn,-homeserviceYn2,-orderDate",
    page: "1",
    pageSize: "50",
    includeFields:
      "carSeq,fileNameArray,ownerYn,makerName,className,carName,modelName,gradeName,regiDay,yymm,km,cityCodeName2,sellAmtGbn,sellAmt,sellAmtPrev,carMasterSpecialYn,monthLeaseAmt,interestFreeYn,ownerYn,directYn,carAccidentNo,warrantyYn,falsityYn,kbLeaseYn,friendDealerYn,orderDate,certifiedShopYn,kbCertifiedYn,hasOverThreeFileNames,diagYn,diagGbn,lineAdYn,tbMemberMemberName,carAccidentNo,colorCodeName,gasName,safeTel,carHistorySeq,homeserviceYn2,labsDanjiNo2,premiumYn,premiumVideo,premiumVideoType,premiumVideoImage,t34SellGbn,t34MonthAmt,t34DiscountAmt,adState,shopPenaltyYn,paymentPremiumYn,paymentPremiumText,paymentPremiumMarkCdArray,paymentPremiumMarkNmArray,contractingYn,partnerCertifiedYn,seatColorCode,seatColorNm,paymentPlayYn",
    displaySoldoutYn: "N",
    v: String(Date.now()),
    searchAfter,
  });
  return `${baseUrl}?${params.toString()}`;
}

function buildKbListUrl(page: number) {
  const params = new URLSearchParams({
    makerCode: "109",
    classCode: "1941",
    carCode: "1552",
    page: String(page),
    regiDay: `${KB_MIN_YEAR},${KB_MAX_YEAR}`,
    sellAmt: `,${KB_MAX_PRICE_MANWON}`,
    km: `,${KB_MAX_KM}`,
  });
  return `${KB_LIST_BASE_URL}?${params.toString()}`;
}

function makeKbPhotoUrl(sourceId: string, fileName: string, shard: string) {
  const group = sourceId.slice(0, 4);
  return `https://img.kbchachacha.com/IMG/carimg/l/img${shard}/img${group}/${fileName}?width=720`;
}

function resolveKbShard(sourceId: string) {
  const group = sourceId.slice(0, 4);
  if (group.length < 4) return "01";
  const lastDigit = Number(group[3]);
  if (!Number.isInteger(lastDigit) || lastDigit < 0 || lastDigit > 9) return "01";
  return lastDigit === 0 ? "10" : String(lastDigit).padStart(2, "0");
}

async function normalizeHit(hit: KbSearchHit): Promise<ParsedCarRecord | null> {
  // KBCHA marks reserved/sold listings in search payload.
  // Skip them so they are deactivated in our DB on sync.
  const contractingYn = (hit.contractingYn ?? "").trim().toUpperCase();
  if (contractingYn === "Y") return null;
  const adState = (hit.adState ?? "").trim();
  if (adState && !ACTIVE_AD_STATES.has(adState)) return null;

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
  const resolvedShard = resolveKbShard(sourceId);
  const photos: CarPhoto[] =
    fileNames.length === 0
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

function stripHtmlTags(raw: string) {
  return raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function decodeHtmlEntities(raw: string) {
  return raw
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function parseYearFromLabel(label: string) {
  const match = label.match(/(\d{2})\/\d{2}식/);
  if (!match) return 0;
  const yy = Number(match[1]);
  if (!Number.isInteger(yy)) return 0;
  return yy >= 90 ? 1900 + yy : 2000 + yy;
}

function parseFirstMatch(block: string, re: RegExp) {
  const match = block.match(re);
  if (!match) return "";
  return decodeHtmlEntities(stripHtmlTags(match[1] ?? ""));
}

function parseListPageCars(html: string): ParsedCarRecord[] {
  const chunks = html.split('<div class="area ').slice(1);
  const parsed: ParsedCarRecord[] = [];
  const seen = new Set<string>();

  for (const chunk of chunks) {
    const block = `<div class="area ${chunk}`;
    const sourceId = parseFirstMatch(block, /data-car-seq="(\d+)"/i);
    if (!sourceId || seen.has(sourceId)) continue;
    seen.add(sourceId);

    const title = parseFirstMatch(block, /<strong class="tit">([\s\S]*?)<\/strong>/i);
    const dataLineMatch = block.match(/<div class="data-line">([\s\S]*?)<\/div>/i);
    const dataLineRaw = dataLineMatch?.[1] ?? "";
    const spans = Array.from(dataLineRaw.matchAll(/<span>([\s\S]*?)<\/span>/gi)).map((item) =>
      decodeHtmlEntities(stripHtmlTags(item[1] ?? "")),
    );
    const year = parseYearFromLabel(spans[0] ?? "");
    const mileageKm = Number((spans[1] ?? "").replace(/[^\d]/g, ""));

    const priceRaw = parseFirstMatch(block, /<span class="price">([\s\S]*?)<\/span>/i);
    const sellAmt = Number(priceRaw.replace(/[^\d]/g, ""));
    const photoUrl = parseFirstMatch(block, /<img[^>]+src="([^"]+)"/i);

    const mapped = mapKbcha({
      sourceId,
      year: Number.isFinite(year) ? year : 0,
      mileageKm: Number.isFinite(mileageKm) ? mileageKm : 0,
      sellAmt,
      accidentCount: null,
      mainPhoto: photoUrl || null,
      photos: photoUrl
        ? [
            {
              type: "001",
              location: photoUrl,
              updatedDate: "",
              ordering: 1,
            },
          ]
        : [],
      badge: title,
      modifiedDate: "",
    });

    if (mapped) parsed.push(mapped);
  }

  return parsed;
}

async function fetchKbchaCarsFromListHtml() {
  const cars: ParsedCarRecord[] = [];
  const seen = new Set<string>();
  const htmlHeaders = { ...KB_HEADERS, Accept: "text/html, */*;q=0.8" };

  for (let page = 1; page <= 30; page += 1) {
    const response = await fetchWithTimeout(
      buildKbListUrl(page),
      {
        headers: htmlHeaders,
      },
      SEARCH_TIMEOUT_MS,
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} while fetching kbcha cars from list.empty`);
    }

    const html = await response.text();
    const pageCars = parseListPageCars(html);
    if (pageCars.length === 0) break;

    let addedOnPage = 0;
    for (const car of pageCars) {
      if (seen.has(car.sourceId)) continue;
      seen.add(car.sourceId);
      cars.push(car);
      addedOnPage += 1;
    }

    if (addedOnPage === 0) break;
  }

  return cars;
}

async function fetchKbchaCarsFromJsonSearch() {
  const cars: ParsedCarRecord[] = [];
  let searchAfter = "";
  let activeEndpoint: string | null = null;

  for (let page = 0; page < 30; page += 1) {
    let payload: KbSearchResponse | null = null;
    let selectedEndpoint: string | null = null;
    let lastNon404Status: number | null = null;

    const endpointsToTry: readonly string[] = activeEndpoint
      ? [activeEndpoint]
      : KB_SEARCH_ENDPOINTS;
    for (const endpoint of endpointsToTry) {
      const response = await fetchWithTimeout(
        buildKbSearchUrl(endpoint, searchAfter),
        {
          headers: KB_HEADERS,
        },
        SEARCH_TIMEOUT_MS,
      );

      if (response.ok) {
        payload = (await response.json()) as KbSearchResponse;
        selectedEndpoint = endpoint;
        break;
      }

      if (response.status !== 404) {
        lastNon404Status = response.status;
      }
    }

    if (!payload || !selectedEndpoint) {
      if (lastNon404Status != null) {
        throw new Error(`HTTP ${lastNon404Status} while fetching kbcha cars`);
      }
      throw new Error(`HTTP 404 while fetching kbcha cars (tried: ${KB_SEARCH_ENDPOINTS.join(", ")})`);
    }

    activeEndpoint = selectedEndpoint;
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

  return cars;
}

export async function fetchKbchaCars(): Promise<ParsedCarsResponse> {
  let cars: ParsedCarRecord[];
  try {
    cars = await fetchKbchaCarsFromJsonSearch();
  } catch {
    cars = await fetchKbchaCarsFromListHtml();
  }

  return {
    cars,
    updatedAt: new Date().toISOString(),
    isPartial: true,
    filter: {
      minYear: KB_MIN_YEAR,
      maxYear: KB_MAX_YEAR,
      maxMileageKm: KB_MAX_KM,
      maxPriceWon: KB_MAX_PRICE_WON,
    },
  };
}
