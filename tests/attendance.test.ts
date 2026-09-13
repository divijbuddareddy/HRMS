import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { calculateHaversineDistance } from '../src/lib/attendance/engine';

describe('1C. Attendance Engine & GPS Geofencing', () => {
  it('should accurately calculate Haversine distance for geofencing', () => {
    // Indiranagar Office
    const officeCoord = { latitude: 12.9716, longitude: 77.5946 };
    // Employee punch within 50 meters
    const punchNear = { latitude: 12.9718, longitude: 77.5948 };
    // Employee punch 5 km away (Whitefield)
    const punchFar = { latitude: 12.9698, longitude: 77.7500 };

    const distNear = calculateHaversineDistance(officeCoord, punchNear);
    const distFar = calculateHaversineDistance(officeCoord, punchFar);

    expect(distNear).toBeLessThan(100); // within 100 meters
    expect(distFar).toBeGreaterThan(5000); // greater than 5 km
  });
});
