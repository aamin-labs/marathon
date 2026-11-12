// Forecast from Open-Meteo: free, no account or key needed.

export async function fetchConditions(lat: number, lon: number, date: string, hour: number): Promise<{ tempC: number; dewC: number }> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&hourly=temperature_2m,dew_point_2m&start_date=${date}&end_date=${date}&timezone=auto`
  const res = await fetch(url)
  if (!res.ok) throw new Error('No forecast for that day. Forecasts reach about two weeks ahead.')
  const data = await res.json()
  const tempC = data.hourly?.temperature_2m?.[hour]
  const dewC = data.hourly?.dew_point_2m?.[hour]
  if (typeof tempC !== 'number' || typeof dewC !== 'number') throw new Error('No forecast for that day. Forecasts reach about two weeks ahead.')
  return { tempC: Math.round(tempC), dewC: Math.round(dewC) }
}
