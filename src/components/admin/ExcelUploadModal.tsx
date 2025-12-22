import { useState } from 'react';
import { X, Upload, CheckCircle, AlertCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../../lib/supabase';
import { useNotification } from '../../contexts/NotificationContext';

interface ExcelUploadModalProps {
  onClose: () => void;
  onComplete: () => void;
}

export function ExcelUploadModal({ onClose, onComplete }: ExcelUploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: number; failed: number } | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const { showError, showWarning, showSuccess } = useNotification();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      
      // Validate file type
      const validTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
        'application/vnd.ms-excel', // .xls
        'application/excel', // .xls
      ];
      const validExtensions = ['.xlsx', '.xls'];
      const fileExtension = selectedFile.name.toLowerCase().substring(selectedFile.name.lastIndexOf('.'));
      
      if (!validTypes.includes(selectedFile.type) && !validExtensions.includes(fileExtension)) {
        showError(
          'Invalid File Type',
          'Please upload a valid Excel file (.xlsx or .xls format).'
        );
        e.target.value = ''; // Clear the input
        return;
      }

      // Validate file size (max 10MB)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (selectedFile.size > maxSize) {
        showError(
          'File Too Large',
          `File size (${(selectedFile.size / 1024 / 1024).toFixed(2)} MB) exceeds the maximum allowed size of 10 MB. Please use a smaller file.`
        );
        e.target.value = ''; // Clear the input
        return;
      }

      setFile(selectedFile);
      setResult(null);
      setErrors([]);
    }
  };

  const parseExcelFile = async (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      // Validate file before reading
      if (!file) {
        reject(new Error('No file selected. Please choose an Excel file to upload.'));
        return;
      }

      if (file.size === 0) {
        reject(new Error('The selected file is empty. Please choose a valid Excel file with data.'));
        return;
      }

      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          if (!e.target?.result) {
            reject(new Error('Failed to read file content. The file may be corrupted or in an unsupported format.'));
            return;
          }

          const data = e.target.result;
          
          // Validate that we have binary data
          if (typeof data !== 'string') {
            reject(new Error('Invalid file format. Please ensure you are uploading a valid Excel file (.xlsx or .xls).'));
            return;
          }

          let workbook;
          try {
            workbook = XLSX.read(data, { 
              type: 'binary',
              cellDates: true,
              cellNF: false,
              cellText: false
            });
          } catch (parseError: any) {
            reject(new Error(`Failed to parse Excel file: ${parseError.message || 'Invalid Excel format'}. Please ensure the file is a valid .xlsx or .xls file and is not corrupted.`));
            return;
          }

          if (!workbook || !workbook.SheetNames || workbook.SheetNames.length === 0) {
            reject(new Error('The Excel file contains no worksheets. Please ensure your file has at least one sheet with data.'));
            return;
          }

          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];

          if (!worksheet) {
            reject(new Error('The first worksheet in the Excel file is empty or invalid. Please check your file.'));
            return;
          }

          // Convert to array of arrays to handle complex formats
          let rawData: any[][];
          try {
            rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });
          } catch (convertError: any) {
            reject(new Error(`Failed to convert worksheet data: ${convertError.message || 'Unknown error'}. Please check your Excel file format.`));
            return;
          }

          if (!rawData || rawData.length === 0) {
            reject(new Error('The Excel file contains no data rows. Please ensure your file has data below the header row.'));
            return;
          }

          // Find the header row by looking for the first row with required columns
          let headerRowIndex = -1;

          for (let i = 0; i < Math.min(rawData.length, 20); i++) {
            const row = rawData[i];
            if (Array.isArray(row)) {
              const rowStr = row.join('|').toUpperCase();
              // Check if this row contains the table headers
              // Looking for: SR, FLT NO, REG NO, MAKE, TYPE (not MODEL)
              if ((rowStr.includes('REG NO') || rowStr.includes('REG')) &&
                  rowStr.includes('MAKE') &&
                  (rowStr.includes('TYPE') || rowStr.includes('MODEL')) &&
                  (rowStr.includes('FLT') || rowStr.includes('FLEET'))) {
                headerRowIndex = i;
                break;
              }
            }
          }

          if (headerRowIndex === -1) {
            console.error('Header detection failed. First 5 rows:', rawData.slice(0, 5));
            reject(new Error('Could not find data table headers. Expected columns: REG NO (or REG), MAKE, TYPE (or MODEL), and FLT NO (or FLEET). Please check your Excel file format and ensure these column headers exist.'));
            return;
          }

          console.log('Found headers at row', headerRowIndex, ':', rawData[headerRowIndex]);

          // Extract headers and normalize them
          const headers = rawData[headerRowIndex].map((h: any) =>
            String(h || '').trim()
          );

          // Convert data rows to objects
          const jsonData: any[] = [];
          for (let i = headerRowIndex + 1; i < rawData.length; i++) {
            const row = rawData[i];
            if (!row || row.length === 0) continue;

            // Skip rows that are completely empty or just contain metadata
            const hasData = row.some((cell: any) => cell !== null && cell !== undefined && String(cell).trim() !== '');
            if (!hasData) continue;

            const rowObj: any = {};
            headers.forEach((header: string, index: number) => {
              if (header && row[index] !== null && row[index] !== undefined) {
                rowObj[header] = row[index];
              }
            });

            // Only add rows that have at least some meaningful data
            if (Object.keys(rowObj).length > 0) {
              jsonData.push(rowObj);
            }
          }

          if (jsonData.length === 0) {
            reject(new Error('No valid data rows found in the Excel file. Please ensure your file has data rows below the header row.'));
            return;
          }

          resolve(jsonData);
        } catch (error: any) {
          // Provide more specific error messages
          if (error.message) {
          reject(error);
          } else {
            reject(new Error(`Unexpected error while processing file: ${error.toString() || 'Unknown error'}. Please try again or contact support if the problem persists.`));
          }
        }
      };
      
      reader.onerror = (error) => {
        console.error('FileReader error:', error);
        reject(new Error('Failed to read the file. This may happen if the file is corrupted, in use by another program, or too large. Please try: 1) Closing the file if it\'s open, 2) Saving a fresh copy, 3) Checking file size (max 10MB), or 4) Trying a different file.'));
      };
      
      reader.onabort = () => {
        reject(new Error('File reading was cancelled. Please try uploading again.'));
      };

      try {
      reader.readAsBinaryString(file);
      } catch (readError: any) {
        reject(new Error(`Failed to start reading file: ${readError.message || 'Unknown error'}. Please ensure the file is a valid Excel file and try again.`));
      }
    });
  };

  const handleUpload = async () => {
    if (!file) return;

    setLoading(true);
    setErrors([]);

    try {
      let data: any[];
      try {
        data = await parseExcelFile(file);
      console.log('Parsed Excel data:', data.length, 'rows');
      console.log('First row sample:', data[0]);
      } catch (parseError: any) {
        const errorMsg = parseError.message || 'Failed to parse Excel file';
        setErrors([errorMsg]);
        showError('File Parse Error', errorMsg);
        setLoading(false);
        return;
      }

      if (!data || data.length === 0) {
        const errorMsg = 'The Excel file contains no data rows. Please ensure your file has data rows below the header.';
        setErrors([errorMsg]);
        showError('Empty File', errorMsg);
        setLoading(false);
        return;
      }

      // Get current admin user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        const errorMsg = 'You must be logged in as an admin to import lots';
        setErrors([errorMsg]);
        showError('Authentication Required', errorMsg);
        setLoading(false);
        return;
      }

      // Get admin_users record
      const { data: adminData } = await supabase
        .from('admin_users')
        .select('id')
        .eq('email', user.email)
        .single();

      if (!adminData) {
        const errorMsg = 'Admin user not found. Please contact system administrator';
        setErrors([errorMsg]);
        showError('Admin Access Error', errorMsg);
        setLoading(false);
        return;
      }

      // Extract LOT NUMBER from the first row (should be same for all rows in the file)
      const getColumnValue = (possibleNames: string[]) => {
        if (data.length === 0) return null;
        for (const name of possibleNames) {
          for (const key in data[0]) {
            if (key.toUpperCase().includes(name.toUpperCase())) {
              return data[0][key];
            }
          }
        }
        return null;
      };

      const lotNumber = getColumnValue(['LOT#', 'LOT #', 'LOT NUMBER', 'LOT NO', 'LOT_NUMBER', 'LOT_NO', 'LOT']);
      
      if (!lotNumber || String(lotNumber).trim() === '') {
        const errorMsg = 'Lot# column is required in the Excel file. Please add a Lot# column with a value in the first row.';
        setErrors([errorMsg]);
        showError('Missing Lot Number', errorMsg);
        setLoading(false);
        return;
      }

      const lotNumberStr = String(lotNumber).trim();

      // Validate lot number format
      if (lotNumberStr.length > 100) {
        const errorMsg = `Lot number is too long (maximum 100 characters). Current: ${lotNumberStr.length} characters.`;
        setErrors([errorMsg]);
        showError('Invalid Lot Number', errorMsg);
        setLoading(false);
        return;
      }

      // Check if lot number already exists
      const { data: existingLot, error: checkError } = await supabase
        .from('lots')
        .select('lot_number, name')
        .eq('lot_number', lotNumberStr)
        .single();

      if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = not found, which is good
        const errorMsg = `Error checking lot number: ${checkError.message}`;
        setErrors([errorMsg]);
        showError('Database Error', errorMsg);
        setLoading(false);
        return;
      }

      if (existingLot) {
        const errorMsg = `Lot number "${lotNumberStr}" already exists in the system. Please use a different lot number or update the existing lot "${existingLot.name || existingLot.lot_number}".`;
        setErrors([errorMsg]);
        showError('Duplicate Lot Number', errorMsg);
        setLoading(false);
        return;
      }

      // Create a new lot with the lot number from Excel
      const { data: newLot, error: createLotError } = await supabase
        .from('lots')
        .insert({
          lot_number: lotNumberStr,
          name: `Lot ${lotNumberStr}`,
          uploaded_by: adminData.id,
          status: 'Pending',
          approved: false,
        })
        .select()
        .single();

      if (createLotError || !newLot) {
        const errorMsg = `Failed to create lot "${lotNumberStr}": ${createLotError?.message || 'Unknown error'}`;
        setErrors([errorMsg]);
        showError('Lot Creation Failed', errorMsg);
        setLoading(false);
        return;
      }

        // Now insert cars with lot_id
        let successCount = 0;
        let failedCount = 0;
        const errorMessages: string[] = [];

        for (const row of data) {
        try {
          // Find the actual column names (case-insensitive and flexible matching)
          const getColumnValue = (possibleNames: string[]) => {
            for (const name of possibleNames) {
              for (const key in row) {
                if (key.toUpperCase().includes(name.toUpperCase())) {
                  return row[key];
                }
              }
            }
            return null;
          };

          // Extract values - matching Excel columns (supports both old and new column names)
          const srNumber = getColumnValue(['S#', 'SR', 'SERIAL']);
          const fleetNo = getColumnValue(['FLEET #', 'FLEET#', 'FLT NO', 'FLTNO', 'FLEET NO']);
          const regNo = getColumnValue(['REG #', 'REG#', 'REG NO', 'REGNO', 'REGISTRATION']);
          const currentLocation = getColumnValue(['CURRENT LOCATION', 'CURRENT LOC', 'LOCATION']);
          const bodyType = getColumnValue(['TYPE / MODEL', 'TYPE/MODEL', 'TYPE', 'MODEL']);
          const make = getColumnValue(['MAKE']);
          const chassisNo = getColumnValue(['CHASSIS #', 'CHASSIS#', 'CHASSIS NO', 'CHASSISNO', 'CHASSIS']);
          const color = getColumnValue(['COLOR', 'COLOUR']);
          const year = getColumnValue(['YEAR']);
          const km = getColumnValue(['KM', 'KILOMETERS', 'KILOMETRES', 'MILEAGE']);
          const price = getColumnValue(['BID PRICE', 'PRICE BID', 'PRICE', 'BID']);

          // Additional fields for other sheets
          const engineNo = getColumnValue(['ENGINE']);
          const transmission = getColumnValue(['TRANS']);
          const fuelType = getColumnValue(['FUEL']);
          const location = getColumnValue(['LOCATION']);
          const seats = getColumnValue(['SEAT']);
          const doors = getColumnValue(['DOOR']);

          // Build make_model from Make and TYPE columns
          let makeModelStr = '';
          if (make && bodyType) {
            makeModelStr = `${String(make).trim()} ${String(bodyType).trim()}`.trim();
          } else if (make) {
            makeModelStr = String(make).trim();
          } else if (bodyType) {
            makeModelStr = String(bodyType).trim();
          }

          const carData: any = {
            sr_number: srNumber ? String(srNumber).trim() : null,
            fleet_no: fleetNo ? String(fleetNo).trim() : null,
            reg_no: regNo ? String(regNo).trim() : null,
            make_model: makeModelStr,
            year: year ? parseInt(String(year).replace(/[^0-9]/g, '')) || null : null,
            km: km ? parseInt(String(km).replace(/[^0-9]/g, '')) || null : null,
            price: price ? parseFloat(String(price).replace(/[^0-9.]/g, '')) || null : null,
            location: location || currentLocation ? String(location || currentLocation).trim() : null,
            chassis_no: chassisNo ? String(chassisNo).trim() : null,
            engine_no: engineNo ? String(engineNo).trim() : null,
            color: color ? String(color).trim() : null,
            fuel_type: fuelType ? String(fuelType).trim() : null,
            transmission: transmission ? String(transmission).trim() : null,
            body_type: bodyType ? String(bodyType).trim() : null,
            seats: seats ? parseInt(String(seats).replace(/[^0-9]/g, '')) || null : null,
            doors: doors ? parseInt(String(doors).replace(/[^0-9]/g, '')) || null : null,
            current_location: currentLocation ? String(currentLocation).trim() : null,
            lot_id: newLot.id, // Associate car with the lot
          };

          // Must have at least reg_no or make_model or chassis_no
          if (!carData.make_model && !carData.reg_no && !carData.chassis_no) {
            const rowNum = data.indexOf(row) + 1;
            errorMessages.push(`Row ${rowNum}: Missing required data (Make/Model, Reg#, or Chassis#). Row skipped.`);
            failedCount++;
            continue;
          }

          // Use reg_no as fallback for make_model
          if (!carData.make_model && carData.reg_no) {
            carData.make_model = `Vehicle ${carData.reg_no}`;
          }

          if (successCount === 0) {
            console.log('First car data being inserted:', carData);
          }

          const { error } = await supabase.from('cars').insert(carData);

          if (error) {
            const rowNum = data.indexOf(row) + 1;
            const carIdentifier = carData.reg_no || carData.make_model || carData.chassis_no || `Row ${rowNum}`;
            let errorMsg = `Row ${rowNum} (${carIdentifier}): ${error.message}`;
            
            // Provide more helpful error messages for common issues
            if (error.message.includes('duplicate') || error.message.includes('unique')) {
              errorMsg = `Row ${rowNum} (${carIdentifier}): Duplicate entry. This car may already exist in the system.`;
            } else if (error.message.includes('foreign key') || error.message.includes('lot_id')) {
              errorMsg = `Row ${rowNum} (${carIdentifier}): Invalid lot association. Please try importing again.`;
            } else if (error.message.includes('null value') || error.message.includes('not null')) {
              errorMsg = `Row ${rowNum} (${carIdentifier}): Missing required field. Please check your Excel file.`;
            }
            
            errorMessages.push(errorMsg);
            failedCount++;
          } else {
            successCount++;
          }
        } catch (error: any) {
          const rowNum = data.indexOf(row) + 1;
          errorMessages.push(`Row ${rowNum}: Error processing - ${error.message || 'Unknown error'}`);
          failedCount++;
        }
      }

      setResult({ success: successCount, failed: failedCount });
      setErrors(errorMessages);

      // Show appropriate notifications based on results
      if (successCount > 0 && failedCount === 0) {
        showSuccess(
          'Import Successful',
          `Successfully imported ${successCount} car${successCount > 1 ? 's' : ''} into lot "${lotNumberStr}"`
        );
        setTimeout(() => {
          onComplete();
        }, 2000);
      } else if (successCount > 0 && failedCount > 0) {
        showWarning(
          'Partial Import Success',
          `Imported ${successCount} car${successCount > 1 ? 's' : ''} successfully, but ${failedCount} car${failedCount > 1 ? 's' : ''} failed. Please check the error details below.`
        );
        // Don't auto-close on partial success, let user review errors
      } else if (successCount === 0 && failedCount > 0) {
        showError(
          'Import Failed',
          `Failed to import all ${failedCount} car${failedCount > 1 ? 's' : ''}. Please check the error details and try again.`
        );
      } else if (data.length === 0) {
        showError(
          'No Data Found',
          'The Excel file appears to be empty or contains no valid data rows. Please check your file format.'
        );
      }
    } catch (error: any) {
      let errorMsg = `Failed to process file: ${error.message || 'Unknown error'}`;
      
      // Provide more helpful error messages for common file issues
      if (error.message?.includes('header') || error.message?.includes('Could not find')) {
        errorMsg = 'Could not find required column headers in the Excel file. Please ensure your file has columns: REG NO, MAKE, TYPE, and FLT NO (or FLEET).';
      } else if (error.message?.includes('read') || error.message?.includes('parse')) {
        errorMsg = 'Failed to read or parse the Excel file. Please ensure the file is a valid .xlsx or .xls format and is not corrupted.';
      } else if (error.message?.includes('format')) {
        errorMsg = 'Invalid file format. Please upload a valid Excel file (.xlsx or .xls).';
      }
      
      setErrors([errorMsg]);
      showError('File Processing Error', errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto flex flex-col">
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-slate-200 flex-shrink-0">
          <h2 className="text-lg sm:text-2xl font-bold text-slate-900">Import Cars from Excel</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
          <div className="mb-6">
            <h3 className="font-semibold text-slate-900 mb-2">Excel File Requirements:</h3>
            <ul className="list-disc list-inside text-sm text-slate-600 space-y-1">
              <li><strong>Lot#</strong> - <span className="text-red-600">Required</span> - Must be unique (e.g., LOT-20250116-001)</li>
              <li><strong>Make</strong> - <span className="text-red-600">Required</span> - Vehicle manufacturer/brand</li>
              <li>Columns: Lot#, S#, Fleet #, Reg #, Current Location, Type / Model, Make, Chassis #, Color, Year, KM, Bid Price (all optional except Lot# and Make)</li>
              <li>Bid Price is <strong>optional</strong> - not required for import</li>
              <li>File should be in .xlsx or .xls format</li>
              <li>All vehicles in the same file will be assigned to the same Lot#</li>
            </ul>
            <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-xs text-yellow-800">
                <strong>Note:</strong> If the Lot# already exists in the system, the import will fail. 
                Each lot number must be unique.
              </p>
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Choose Excel File
            </label>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="block w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-dl-grey-bg file:text-dl-red hover:file:bg-slate-100"
            />
          </div>

          {result && (
            <div className={`mb-6 p-4 rounded-lg border ${
              result.failed === 0 
                ? 'bg-green-50 border-green-200' 
                : result.success > 0 
                  ? 'bg-orange-50 border-orange-200'
                  : 'bg-red-50 border-red-200'
            }`}>
              <div className="flex items-start gap-3">
                {result.failed === 0 ? (
                  <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className={`w-6 h-6 flex-shrink-0 mt-0.5 ${
                    result.success > 0 ? 'text-orange-600' : 'text-red-600'
                  }`} />
                )}
                <div className="flex-1">
                  <p className="font-semibold text-slate-900 mb-2">Import Results:</p>
                  <div className="space-y-1">
                    <p className="text-sm text-slate-700">
                      <span className="font-medium">Successfully imported:</span>{' '}
                      <span className="font-bold text-green-600">{result.success}</span> car{result.success !== 1 ? 's' : ''}
                  </p>
                  {result.failed > 0 && (
                      <p className="text-sm text-slate-700">
                        <span className="font-medium">Failed:</span>{' '}
                        <span className="font-bold text-red-600">{result.failed}</span> car{result.failed !== 1 ? 's' : ''}
                    </p>
                  )}
                    <p className="text-xs text-slate-500 mt-2">
                      Total processed: {result.success + result.failed} car{result.success + result.failed !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
              </div>

              {errors.length > 0 && (
                <div className="mt-4 p-3 bg-white rounded border border-slate-300 max-h-60 overflow-y-auto">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold text-slate-900">
                      Error Details ({errors.length} error{errors.length !== 1 ? 's' : ''}):
                    </p>
                    {errors.length > 10 && (
                      <span className="text-xs text-slate-500">
                        Showing first 10 of {errors.length}
                      </span>
                    )}
                  </div>
                  <ul className="text-xs text-slate-700 space-y-1.5">
                    {errors.slice(0, 10).map((error, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-red-500 mt-0.5">•</span>
                        <span className="break-words flex-1">{error}</span>
                      </li>
                    ))}
                    {errors.length > 10 && (
                      <li className="text-xs font-medium text-slate-500 pt-2 border-t border-slate-200">
                        ... and {errors.length - 10} more error{errors.length - 10 !== 1 ? 's' : ''}. 
                        Please review your Excel file and fix the issues.
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}

          {errors.length > 0 && !result && (
            <div className="mb-6 p-4 bg-red-50 rounded-lg border border-red-200">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold text-red-900 mb-2">Import Errors:</p>
                  <ul className="text-sm text-red-800 space-y-1">
                    {errors.map((error, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="mt-0.5">•</span>
                        <span className="break-words flex-1">{error}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleUpload}
              disabled={!file || loading}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-dl-red text-white rounded-lg hover:bg-dl-red-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>Processing...</>
              ) : (
                <>
                  <Upload className="w-5 h-5" />
                  Upload & Import
                </>
              )}
            </button>
            <button
              onClick={onClose}
              className="px-6 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
