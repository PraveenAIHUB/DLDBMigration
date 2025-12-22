/**
 * Utility function to format car data for export in consistent format
 * Used across all export functions to ensure uniform structure
 * 
 * Format:
 * 1. Lot#
 * 2. S# (sequential 1, 2, 3... N)
 * 3. Fleet #
 * 4. Reg #
 * 5. Current Location
 * 6. Type / Model
 * 7. Make
 * 8. Chassis #
 * 9. Color
 * 10. Year
 * 11. KM
 */

export interface CarExportData {
  'Lot#': string;
  'S#': number;
  'Fleet #': string;
  'Reg #': string;
  'Current Location': string;
  'Type / Model': string;
  'Make': string;
  'Chassis #': string;
  'Color': string;
  'Year': number | string;
  'KM': number | string;
}

/**
 * Formats a car object for export with consistent structure
 * @param car - The car object from database
 * @param index - The index in the array (0-based, used as fallback if sr_number is not available)
 * @param lotNumber - The lot number (can be from car.lots or passed separately)
 * @returns Formatted car data object
 */
export function formatCarForExport(
  car: any,
  index: number,
  lotNumber?: string
): CarExportData {
  // Get lot number from car.lots or use provided lotNumber
  const lotNum = lotNumber || (car.lots as any)?.lot_number || (car.lot as any)?.lot_number || '-';

  // Extract Make and Model from make_model if it contains both
  let make = '';
  let typeModel = '';
  if (car.make_model) {
    // Try to split make/model (e.g., "Toyota Camry" -> Make: "Toyota", Type/Model: "Camry")
    const parts = car.make_model.trim().split(/\s+/);
    if (parts.length > 1) {
      make = parts[0]; // First word is usually Make
      typeModel = parts.slice(1).join(' '); // Rest is Type/Model
    } else {
      // If only one word, assume it's Make
      make = car.make_model;
      typeModel = '';
    }
  }

  // Use the original SR number from import sheet, fallback to sequential number if not available
  const sNumber = car.sr_number || (index + 1);

  return {
    'Lot#': lotNum,
    'S#': sNumber, // Use original SR number from import sheet, or sequential number as fallback
    'Fleet #': car.fleet_no || '',
    'Reg #': car.reg_no || '',
    'Current Location': car.current_location || car.location || '',
    'Type / Model': typeModel || car.body_type || '',
    'Make': make || car.make_model || '',
    'Chassis #': car.chassis_no || '',
    'Color': car.color || '',
    'Year': car.year || '',
    'KM': car.km || '',
  };
}

