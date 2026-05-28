// modules/shared/routesMatrix.js

/**
 * Static Matrix of Popular Routes, Kilometers, and Base Fares for IshanCabs
 * Flat base rates are provided for local/intercity node pairs.
 */
export const routesMatrix = {
    "Howrah Station": {
        "Airport": { km: 18, base_fare_sedan: 999, base_fare_suv: 1499 },
        "Digha": { km: 185, base_fare_sedan: 4500, base_fare_suv: 6500 },
        "Mayapur": { km: 130, base_fare_sedan: 3800, base_fare_suv: 5200 },
        "Shantiniketan": { km: 165, base_fare_sedan: 4200, base_fare_suv: 5800 }
    },
    "Airport": {
        "Howrah Station": { km: 18, base_fare_sedan: 999, base_fare_suv: 1499 },
        "Salt Lake": { km: 12, base_fare_sedan: 500, base_fare_suv: 800 },
        "Esplanade": { km: 16, base_fare_sedan: 700, base_fare_suv: 1100 },
        "Mandarmani": { km: 175, base_fare_sedan: 4800, base_fare_suv: 6800 }
    },
    "Esplanade": {
        "Airport": { km: 16, base_fare_sedan: 700, base_fare_suv: 1100 },
        "Digha": { km: 182, base_fare_sedan: 4500, base_fare_suv: 6500 },
        "Tarapith": { km: 220, base_fare_sedan: 5500, base_fare_suv: 7800 }
    },
    "Salt Lake": {
        "Airport": { km: 12, base_fare_sedan: 500, base_fare_suv: 800 },
        "Howrah Station": { km: 15, base_fare_sedan: 650, base_fare_suv: 950 }
    }
};

/**
 * Returns available pickup locations listed in the matrix
 * @returns {string[]}
 */
export function getPickupLocations() {
    return Object.keys(routesMatrix);
}

/**
 * Returns drop destinations for a specific pickup location
 * @param {string} pickup 
 * @returns {string[]}
 */
export function getDropDestinations(pickup) {
    if (!routesMatrix[pickup]) return [];
    return Object.keys(routesMatrix[pickup]);
}

/**
 * Retrieves exact metrics for a specific pickup-drop pair
 * @param {string} pickup 
 * @param {string} drop 
 * @returns {object|null}
 */
export function getRouteMetrics(pickup, drop) {
    if (!routesMatrix[pickup] || !routesMatrix[pickup][drop]) return null;
    return routesMatrix[pickup][drop];
}
