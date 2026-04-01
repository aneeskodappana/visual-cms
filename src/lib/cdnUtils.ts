const BLOB_BASE_URL = 'https://worlddev.aldar.com/assets/';

export enum ViewTypes {
  'Globe' = 0,
  'Nation' = 1,
  'City' = 2,
  'Project' = 3,
  'Cluster' = 4,
  'Amenity' = 5,
  'Property' = 6,
  'Floor' = 7,
  'Interior' = 8,
  'Gallery' = 9,
  'ParkingFloorplan' = 10,
  'ParkingUpgrade' = 11,
  'ParkingUpgradeGallery' = 12,
}

export enum MarkerTypes {
  'Base',
  'AldarProjectCity',
  'GlobeCity',
  'Project',
  'Cluster',
  'City',
  'Landmark',
  'Unit',
  'Floor',
  'Floorplan',
  'RoomWaypoint',
  'Exterior360',
  'OnSideLandmark',
  'Viewpoint',
  'Project_Animated',
  'IFrame',
  'Project_Overlay',
  'Amenity',
  'Hero',
  'Parking_Lot',
  'Retail_Floor_Hotspot'
}

export enum MarkerSubTypes {
  'Base',
  // Amenity SubTypes
  'Amenity',
  'Airport',
  'Basketball',
  'Beach',
  'Bench',
  'Bicycle',
  'Car',
  'Climbing',
  'Community',
  'Education',
  'Fitness',
  'Fountain',
  'Golf',
  'Health',
  'Landmark',
  'Marina',
  'Mosque',
  'Park',
  'Playground',
  'Plot',
  'Pool',
  'Polo',
  'Retail',
  'Skate',
  'Sport',
  'TableTennis',
  'Tennis',
  'Tower',
  'Train',
  'Utility',
  'Yoga',
  'VillaAndTower',
  'Villa',
  'Aldar',
  'LondonSquare',
  'Parking_Elevator',
  'Text',
  'District',
  'Cafe',
  'AthlonAttraction',
  'YasLinks',
  'MarinaCircuit',
  'FerrariWorld',
  'FahidIsland',
  'SaadiyatIsland',
}

/**
 * Converts a Kind number to its ViewTypes enum name
 * @param kind - The numeric Kind value
 * @returns The ViewTypes enum name or the original number if not found
 */
export const getViewTypeName = (kind?: number): string => {
  if (kind === undefined || kind === null) return '-';
  return ViewTypes[kind] || String(kind);
};

/**
 * Converts a Kind number to its MarkerTypes enum name
 * @param kind - The numeric Kind value
 * @returns The MarkerTypes enum name or the original number if not found
 */
export const getMarkerTypeName = (kind?: number): string => {
  if (kind === undefined || kind === null) return '-';
  return MarkerTypes[kind] || String(kind);
};

/**
 * Converts a SubType number to its MarkerSubTypes enum name
 * @param subType - The numeric SubType value
 * @returns The MarkerSubTypes enum name or the original number if not found
 */
export const getMarkerSubTypeName = (subType?: number): string => {
  if (subType === undefined || subType === null) return '-';
  return MarkerSubTypes[subType] || String(subType);
};

/**
 * Constructs a full CDN URL from a backplate path and ViewConfig CDN base URL
 * @param backplatePath - The relative path to the backplate (e.g., 'image.jpg')
 * @param cdnBaseUrl - The ViewConfig's CDN base URL (e.g., 'mycdn/folder/')
 * @returns Full CDN URL or empty string if no backplate path provided
 */
export const constructCdnUrl = (backplatePath?: string, cdnBaseUrl?: string): string => {
  if (!backplatePath) return '';
  return `${BLOB_BASE_URL}${cdnBaseUrl || ''}${backplatePath}`;
};

/**
 * Constructs a full marker icon URL from a relative path
 * @param iconPath - The relative path to the icon (e.g., 'pins/exterior-360.png')
 * @returns Full icon URL or empty string if no icon path provided
 */
export const constructMarkerIconUrl = (iconPath?: string): string => {
  if (!iconPath) return '';
  return `${BLOB_BASE_URL}${iconPath}`;
};
