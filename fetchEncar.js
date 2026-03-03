import axios from "axios";
import fs from "fs";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchEncar() {
    const allCars = [];

    const headers = {
        "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36",
        Referer: "https://www.encar.com/",
        Origin: "https://www.encar.com",
        Accept: "application/json",
    };

    const q =
        "(And.Hidden.N._.(C.CarType.N._.(C.Manufacturer.아우디._.(C.ModelGroup.A3._.Model.뉴 A3.)))_.Year.range(201700..)._.Price.range(..1400).)";

    const PAGE_SIZE = { premium: 20, general: 50 };
    const endpoints = ["premium", "general"];

    for (let type of endpoints) {
        let page = 0;
        while (true) {
            const offset = page * PAGE_SIZE[type];
            try {
                console.log(
                    `Запрашиваю: ${type} стр.${page + 1} (offset ${offset})...`,
                );

                const response = await axios.get(
                    `https://api.encar.com/search/car/list/${type}`,
                    {
                        headers,
                        params: {
                            count: "true",
                            q,
                            sr: `|ModifiedDate|${offset}|${PAGE_SIZE[type]}`,
                        },
                    },
                );

                const cars = response.data.SearchResults || [];
                console.log(`  Получено: ${cars.length}`);

                if (cars.length === 0) break;

                cars.forEach((car) => {
                    let kishinevTime = "";
                    if (car.ModifiedDate) {
                        try {
                            const dateStr = car.ModifiedDate.replace(
                                " +09",
                                "+09:00",
                            );
                            kishinevTime = new Date(dateStr).toLocaleString(
                                "ru-RU",
                                {
                                    timeZone: "Europe/Chisinau",
                                },
                            );
                        } catch (_) {}
                    }

                    const photoBase = "https://ci.encar.com";
                    const detailedPhotos = car.Photos
                        ? car.Photos.map((p) => ({
                              type: p.type ?? "",
                              location: photoBase + (p.location ?? ""),
                              updatedDate: p.updatedDate ?? "",
                              ordering: p.ordering ?? 0,
                          }))
                        : [];

                    allCars.push({
                        Id: car.Id ?? "",
                        Badge: car.Badge ?? "",
                        FormYear: car.FormYear ?? "",
                        Mileage: car.Mileage ?? 0,
                        PriceWons: (car.Price ?? 0) * 10000,
                        ModifiedDateKishinev: kishinevTime,
                        MainPhoto: detailedPhotos[0]?.location ?? null,
                        Photos: detailedPhotos,
                        hasInspection: (car.Condition ?? []).includes(
                            "Inspection",
                        ),
                    });
                });

                if (cars.length < PAGE_SIZE[type]) break;

                page++;
                await sleep(1500);
            } catch (error) {
                console.error(
                    `  Ошибка ${type} стр.${page + 1}:`,
                    error.message,
                );
                break;
            }
        }
    }

    const seen = new Set();
    const uniqueCars = allCars.filter((car) => {
        const key = `${car.FormYear}_${car.Mileage}_${car.PriceWons}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });

    console.log(`\nВсего уникальных машин: ${uniqueCars.length}`);

    // Актуальный курс вон -> евро
    let WON_TO_EUR = 0.00058;
    try {
        const rateRes = await axios.get(
            "https://api.exchangerate-api.com/v4/latest/KRW",
        );
        WON_TO_EUR = rateRes.data.rates.EUR;
        console.log(`Курс KRW/EUR: ${WON_TO_EUR} (актуальный)`);
    } catch (e) {
        console.warn(
            `Не удалось получить курс, используем fallback: ${WON_TO_EUR}`,
        );
    }

const mapped = uniqueCars.map((r, i) => ({
    id: i + 1,
    year: Number(r.FormYear) || 0,
    mileageKm: r.Mileage,
    price: Math.round(r.PriceWons * WON_TO_EUR),
    priceWon: r.PriceWons,
    url: `https://fem.encar.com/cars/detail/${r.Id}`,
    inspectionUrl:  `https://fem.encar.com/cars/report/inspect/${r.Id}`,
    diagnosisUrl:   `https://fem.encar.com/cars/report/diagnosis/${r.Id}`,
    accidentUrl:    `https://fem.encar.com/cars/report/accident/${r.Id}`,
    hasInspection: r.hasInspection ?? false,
    mainPhoto: r.MainPhoto,
    photos: r.Photos,
    badge: r.Badge,
    modifiedDate: r.ModifiedDateKishinev,
}));

    const tsContent = `// Файл сгенерирован автоматически — не редактировать вручную
// Обновлено: ${new Date().toLocaleString("ru-RU", { timeZone: "Europe/Chisinau" })}

export const CARS = ${JSON.stringify(mapped, null, 2)};

export const MIN_YEAR  = Math.min(...CARS.map((c) => c.year).filter(Boolean));
export const MAX_YEAR  = Math.max(...CARS.map((c) => c.year).filter(Boolean));
export const MIN_MILE  = Math.min(...CARS.map((c) => c.mileageKm));
export const MAX_MILE  = Math.max(...CARS.map((c) => c.mileageKm));
export const MIN_PRICE = Math.min(...CARS.map((c) => c.price));
export const MAX_PRICE = Math.max(...CARS.map((c) => c.price));
`;

    fs.writeFileSync("src/data/cars.ts", tsContent, "utf-8");

    console.log(`\nУспешно!`);
    console.log(`src/data/cars.ts обновлён (${uniqueCars.length} машин)`);
}

fetchEncar();
