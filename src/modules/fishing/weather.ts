import { weatherStates, type WeatherState } from "@/data/weather";

const CYCLE_MS = 6 * 3600 * 1000; // 6 hours per weather cycle

/** Deterministic weather based on UTC time — no Redis needed */
export function getCurrentWeather(): WeatherState {
  const cycle = Math.floor(Date.now() / CYCLE_MS) % weatherStates.length;
  return weatherStates[cycle];
}

/** Get the next N weather periods with their start timestamps */
export function getWeatherForecast(count: number = 4): { weather: WeatherState; startsAt: number }[] {
  const now = Date.now();
  const currentCycleStart = Math.floor(now / CYCLE_MS) * CYCLE_MS;

  return Array.from({ length: count }, (_, i) => {
    const cycleStart = currentCycleStart + i * CYCLE_MS;
    const cycle = Math.floor(cycleStart / CYCLE_MS) % weatherStates.length;
    return { weather: weatherStates[cycle], startsAt: Math.floor(cycleStart / 1000) };
  });
}
