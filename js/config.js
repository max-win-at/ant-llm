/**
 * Configuration for the stigmergic network topology simulation.
 *
 * Paradigm: The habitat is the network address space.
 * URLs are nodes, latencies (RTT) are edges/distances.
 * Ants are async state machines whose movement = fetch().
 */
export const CONFIG = {
  // --- Colony ---
  INITIAL_COLONY_SIZE: 20,
  MAX_COLONY_SIZE: 200,

  // --- Ant (Fetch-Kinetik) ---
  ANT_MAX_ENERGY: 100,
  ANT_INITIAL_ENERGY: 80,
  ANT_ENERGY_DECAY_PER_TICK: 0.15,
  ANT_ENERGY_GAIN_ON_FOOD: 30,
  ANT_FETCH_TIMEOUT_MS: 8000,
  ANT_LATENCY_PENALTY_FACTOR: 0.01, // energy cost per ms of RTT (swamp terrain)

  // --- Pheromone (Temporal Data Points) ---
  PHEROMONE_DECAY_LAMBDA: 0.0001, // λ for temporal decay: intensity * e^(-λ·Δt)
  PHEROMONE_INITIAL_INTENSITY: 1.0,
  PHEROMONE_REPELLENT_INTENSITY: -2.0, // negative pheromone for danger warnings
  PHEROMONE_MAX_INTENSITY: 10,

  // --- Cookie / Food ---
  COOKIE_MAX_AGE_SECONDS: 3600,
  COOKIE_PREFIX: 'antfood_',

  // --- CORS Proxy ---
  // Many public APIs block cross-origin requests from arbitrary domains.
  // Route fetches through a CORS proxy so ants can actually reach their food.
  CORS_PROXY_PREFIX: 'https://corsproxy.io/?',

  // --- Network Habitat (URL Nodes) ---
  // Food types follow biological classification:
  //   sugar  = flat JSON structures → quick energy (cookie storage)
  //   protein = deeply nested objects → brood generation (new ant instances)
  FOOD_SOURCES: [
    {
      name: 'JSONPlaceholder Posts',
      url: 'https://jsonplaceholder.typicode.com/posts/',
      fallbackUrl: 'data/posts.json',
      type: 'sugar',
      nutritionMultiplier: 1.0,
    },
    {
      name: 'JSONPlaceholder Todos',
      url: 'https://jsonplaceholder.typicode.com/todos/',
      fallbackUrl: 'data/todos.json',
      type: 'sugar',
      nutritionMultiplier: 0.8,
    },
    {
      name: 'PokeAPI',
      url: 'https://pokeapi.co/api/v2/pokemon/',
      fallbackUrl: 'data/pokemon.json',
      type: 'protein',
      nutritionMultiplier: 2.0,
    },
    {
      name: 'REST Countries',
      url: 'https://restcountries.com/v3.1/all',
      fallbackUrl: 'data/countries.json',
      type: 'protein',
      nutritionMultiplier: 1.5,
    },
  ],

  // --- Predators in REST-Space ---
  // HTTP 429: Apex-Predator (Ant-Lion) — rate limiting terminates ants
  // HTTP 5xx: Storm — habitat collapse, repellent pheromone deposited
  // Slow Response: Swamp — energy drain from prolonged waiting
  DANGER_SOURCES: [
    {
      name: 'Ant-Lion (429)',
      url: 'https://httpstat.us/429',
      type: 'predator',
      damage: 50,
    },
    {
      name: 'Storm (500)',
      url: 'https://httpstat.us/500',
      type: 'storm',
      damage: 30,
    },
    {
      name: 'Swamp (Slow)',
      url: 'https://httpstat.us/200?sleep=5000',
      type: 'swamp',
      damage: 10,
    },
  ],

  // --- Simulation ---
  TICK_INTERVAL_MS: 1000, // 1 second per tick (network-paced, not 20 FPS)
  MAX_CONCURRENT_FETCHES: 3, // max parallel fetch() operations
  FORAGE_COOLDOWN_TICKS: 5,
  REPRODUCTION_FOOD_THRESHOLD: 5,

  // --- Visualization (Force-Directed Network Graph) ---
  VIS_WIDTH: 900,
  VIS_HEIGHT: 700,
  VIS_NODE_BASE_RADIUS: 20,
  VIS_NEST_RADIUS: 35,
  VIS_EDGE_MAX_WIDTH: 8,
  VIS_PULSE_DURATION_MS: 600,
  VIS_RTT_SCALE_FACTOR: 0.15, // px per ms of avg RTT (distance from center)

  // --- LocalStorage Keys ---
  LS_KEY_ANTS: 'colony_ants',
  LS_KEY_STATS: 'colony_stats',
};
