import { X, Filter } from 'lucide-react';

interface MobileFilterPanelProps {
  isOpen: boolean;
  onClose: () => void;
  filters: {
    location: string;
    makeModel: string;
    year: string;
    minKm: string;
    maxKm: string;
    chassisNo: string;
    regNo: string;
    fleetNo: string;
    lotNumber: string;
    color: string;
    bodyType: string;
  };
  onFilterChange: (filters: any) => void;
  uniqueLocations: string[];
  uniqueLotNumbers: string[];
  uniqueMakeModels: string[];
  uniqueYears: number[];
  uniqueColors?: string[];
  uniqueBodyTypes?: string[];
  onClearFilters: () => void;
}

export function MobileFilterPanel({
  isOpen,
  onClose,
  filters,
  onFilterChange,
  uniqueLocations,
  uniqueLotNumbers,
  uniqueMakeModels,
  uniqueYears,
  uniqueColors = [],
  uniqueBodyTypes = [],
  onClearFilters,
}: MobileFilterPanelProps) {
  if (!isOpen) return null;

  const handleFilterUpdate = (key: string, value: string) => {
    onFilterChange({ ...filters, [key]: value });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 lg:hidden">
      <div className="fixed inset-y-0 right-0 w-full max-w-sm bg-white shadow-2xl flex flex-col">
        {/* Header */}
        <div className="bg-dl-red text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            <h2 className="text-lg font-bold">Filter Cars</h2>
          </div>
          <button onClick={onClose} className="p-2 -m-2 touch-target">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Filter Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Chassis # - Most Important */}
          <div>
            <label className="block text-sm font-semibold text-dl-grey mb-2">
              Chassis # <span className="text-dl-red">*</span>
            </label>
            <input
              type="text"
              value={filters.chassisNo}
              onChange={(e) => handleFilterUpdate('chassisNo', e.target.value)}
              placeholder="Search by Chassis #..."
              className="input-dl w-full"
            />
          </div>

          {/* Registration # */}
          <div>
            <label className="block text-sm font-semibold text-dl-grey mb-2">
              Registration #
            </label>
            <input
              type="text"
              value={filters.regNo}
              onChange={(e) => handleFilterUpdate('regNo', e.target.value)}
              placeholder="Search by Reg #..."
              className="input-dl w-full"
            />
          </div>

          {/* Fleet # */}
          <div>
            <label className="block text-sm font-semibold text-dl-grey mb-2">
              Fleet #
            </label>
            <input
              type="text"
              value={filters.fleetNo}
              onChange={(e) => handleFilterUpdate('fleetNo', e.target.value)}
              placeholder="Search by Fleet #..."
              className="input-dl w-full"
            />
          </div>

          {/* Lot # */}
          <div>
            <label className="block text-sm font-semibold text-dl-grey mb-2">
              Lot #
            </label>
            <select
              value={filters.lotNumber}
              onChange={(e) => handleFilterUpdate('lotNumber', e.target.value)}
              className="input-dl w-full"
            >
              <option value="">All Lots</option>
              {uniqueLotNumbers.map((lotNumber) => (
                <option key={lotNumber} value={lotNumber}>
                  {lotNumber}
                </option>
              ))}
            </select>
          </div>

          {/* Make/Model */}
          <div>
            <label className="block text-sm font-semibold text-dl-grey mb-2">
              Make / Model
            </label>
            <input
              type="text"
              value={filters.makeModel}
              onChange={(e) => handleFilterUpdate('makeModel', e.target.value)}
              placeholder="Search make/model..."
              className="input-dl w-full"
            />
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-semibold text-dl-grey mb-2">
              Location
            </label>
            <select
              value={filters.location}
              onChange={(e) => handleFilterUpdate('location', e.target.value)}
              className="input-dl w-full"
            >
              <option value="">All Locations</option>
              {uniqueLocations.map((location) => (
                <option key={location} value={location}>
                  {location}
                </option>
              ))}
            </select>
          </div>

          {/* Year */}
          <div>
            <label className="block text-sm font-semibold text-dl-grey mb-2">
              Year
            </label>
            <select
              value={filters.year}
              onChange={(e) => handleFilterUpdate('year', e.target.value)}
              className="input-dl w-full"
            >
              <option value="">All Years</option>
              {uniqueYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>

          {/* Mileage Range */}
          <div>
            <label className="block text-sm font-semibold text-dl-grey mb-2">
              Mileage Range (KM)
            </label>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                placeholder="Min KM"
                value={filters.minKm}
                onChange={(e) => handleFilterUpdate('minKm', e.target.value)}
                className="input-dl w-full"
              />
              <input
                type="number"
                placeholder="Max KM"
                value={filters.maxKm}
                onChange={(e) => handleFilterUpdate('maxKm', e.target.value)}
                className="input-dl w-full"
              />
            </div>
          </div>


          {/* Color */}
          {uniqueColors.length > 0 && (
            <div>
              <label className="block text-sm font-semibold text-dl-grey mb-2">
                Color
              </label>
              <select
                value={filters.color}
                onChange={(e) => handleFilterUpdate('color', e.target.value)}
                className="input-dl w-full"
              >
                <option value="">All Colors</option>
                {uniqueColors.map((color) => (
                  <option key={color} value={color}>
                    {color}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Body Type */}
          {uniqueBodyTypes.length > 0 && (
            <div>
              <label className="block text-sm font-semibold text-dl-grey mb-2">
                Body Type
              </label>
              <select
                value={filters.bodyType}
                onChange={(e) => handleFilterUpdate('bodyType', e.target.value)}
                className="input-dl w-full"
              >
                <option value="">All Body Types</option>
                {uniqueBodyTypes.map((body) => (
                  <option key={body} value={body}>
                    {body}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="border-t border-dl-grey-medium p-4 space-y-2">
          <button
            onClick={() => {
              onClearFilters();
              onClose();
            }}
            className="btn-secondary w-full"
          >
            Clear All Filters
          </button>
          <button onClick={onClose} className="btn-primary w-full">
            Apply Filters
          </button>
        </div>
      </div>
    </div>
  );
}
