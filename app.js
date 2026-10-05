const form = document.querySelector("#search-form");
const cityInput = document.querySelector("#city-input");
const searchButton = document.querySelector("#search-button");
const statusMessage = document.querySelector("#status-message");
const weatherCard = document.querySelector("#weather-card");

let activeRequest;

const weatherDescriptions = {
  0: ["Clear sky", "☀️", "🌙"],
  1: ["Mainly clear", "🌤️", "🌙"],
  2: ["Partly cloudy", "⛅", "☁️"],
  3: ["Overcast", "☁️", "☁️"],
  45: ["Foggy", "🌫️", "🌫️"],
  48: ["Depositing rime fog", "🌫️", "🌫️"],
  51: ["Light drizzle", "🌦️", "🌧️"],
  53: ["Moderate drizzle", "🌦️", "🌧️"],
  55: ["Dense drizzle", "🌧️", "🌧️"],
  56: ["Light freezing drizzle", "🌧️", "🌧️"],
  57: ["Dense freezing drizzle", "🌧️", "🌧️"],
  61: ["Light rain", "🌦️", "🌧️"],
  63: ["Moderate rain", "🌧️", "🌧️"],
  65: ["Heavy rain", "🌧️", "🌧️"],
  66: ["Light freezing rain", "🌧️", "🌧️"],
  67: ["Heavy freezing rain", "🌧️", "🌧️"],
  71: ["Light snow", "🌨️", "🌨️"],
  73: ["Moderate snow", "🌨️", "🌨️"],
  75: ["Heavy snow", "❄️", "❄️"],
  77: ["Snow grains", "🌨️", "🌨️"],
  80: ["Light rain showers", "🌦️", "🌧️"],
  81: ["Moderate rain showers", "🌧️", "🌧️"],
  82: ["Violent rain showers", "🌧️", "🌧️"],
  85: ["Light snow showers", "🌨️", "🌨️"],
  86: ["Heavy snow showers", "❄️", "❄️"],
  95: ["Thunderstorm", "⛈️", "⛈️"],
  96: ["Thunderstorm with hail", "⛈️", "⛈️"],
  99: ["Thunderstorm with heavy hail", "⛈️", "⛈️"]
};

function setStatus(message, state = "info") {
  statusMessage.textContent = message;
  statusMessage.dataset.state = state;
}

async function fetchJson(url, signal) {
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`Weather service returned ${response.status}. Please try again.`);
  }
  return response.json();
}

function formatLocalTime(value) {
  const [date, time] = value.split("T");
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const dateLabel = new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: "UTC"
  }).format(new Date(Date.UTC(year, month - 1, day)));
  const timeLabel = `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${hour >= 12 ? "PM" : "AM"}`;
  return `${dateLabel} · ${timeLabel} local time`;
}

function renderWeather(location, weather) {
  const current = weather.current;
  const units = weather.current_units;
  const placeName = [location.name, location.admin1, location.country]
    .filter((part, index, parts) => part && parts.indexOf(part) === index)
    .join(", ");
  const [description, dayIcon, nightIcon] = weatherDescriptions[current.weather_code] ?? [
    "Current conditions",
    "🌤️",
    "🌙"
  ];

  document.querySelector("#location-name").textContent = placeName;
  document.querySelector("#local-time").textContent = formatLocalTime(current.time);
  document.querySelector("#weather-icon").textContent = current.is_day ? dayIcon : nightIcon;
  document.querySelector("#condition-name").textContent = description;
  document.querySelector("#temperature").textContent = Math.round(current.temperature_2m);
  document.querySelector("#feels-like").textContent = Math.round(current.apparent_temperature);
  document.querySelector("#humidity").textContent = Math.round(current.relative_humidity_2m);
  document.querySelector("#wind-speed").textContent = Math.round(current.wind_speed_10m);
  document.querySelector("#wind-unit").textContent = units.wind_speed_10m;
  document.querySelector("#precipitation").textContent = current.precipitation;
  weatherCard.hidden = false;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const city = cityInput.value.trim();
  if (!city) {
    setStatus("Enter a city name to get its weather.", "error");
    cityInput.focus();
    return;
  }

  activeRequest?.abort();
  const controller = new AbortController();
  activeRequest = controller;
  searchButton.disabled = true;
  weatherCard.hidden = true;
  setStatus(`Looking up weather for ${city}...`);

  try {
    const geocodingUrl = new URL("https://geocoding-api.open-meteo.com/v1/search");
    geocodingUrl.search = new URLSearchParams({
      name: city,
      count: "1",
      language: "en",
      format: "json"
    });
    const places = await fetchJson(geocodingUrl, controller.signal);
    const location = places.results?.[0];

    if (!location) {
      setStatus(`We couldn't find "${city}". Check the spelling and try again.`, "error");
      return;
    }

    const weatherUrl = new URL("https://api.open-meteo.com/v1/forecast");
    weatherUrl.search = new URLSearchParams({
      latitude: String(location.latitude),
      longitude: String(location.longitude),
      current: "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m",
      timezone: "auto"
    });
    const weather = await fetchJson(weatherUrl, controller.signal);

    if (!weather.current || !weather.current_units) {
      throw new Error("Current weather is unavailable for this location. Please try another city.");
    }

    renderWeather(location, weather);
    setStatus("");
  } catch (error) {
    if (error.name === "AbortError") return;
    setStatus(
      error instanceof TypeError
        ? "Couldn't connect to the weather service. Check your internet connection and try again."
        : error.message,
      "error"
    );
  } finally {
    if (activeRequest === controller) {
      activeRequest = undefined;
      searchButton.disabled = false;
    }
  }
});
