import { MapPicker } from "./MapPicker";
import { PhoneInput } from "./PhoneInput";

export interface AddressFormValue {
  label: string;
  fullName: string;
  phone: string;
  addressLine: string;
  building: string;
  floor: string;
  apartment: string;
  area: string;
  landmark: string;
  instructions: string;
  lat: number | null;
  lng: number | null;
}

export const emptyAddress = (overrides: Partial<AddressFormValue> = {}): AddressFormValue => ({
  label: "Home",
  fullName: "",
  phone: "",
  addressLine: "",
  building: "",
  floor: "",
  apartment: "",
  area: "",
  landmark: "",
  instructions: "",
  lat: null,
  lng: null,
  ...overrides,
});

const LABELS = ["Home", "Work", "Other"];
const field = "mt-1 w-full rounded-xl border border-oat bg-white px-3.5 py-2.5 text-sm";

/**
 * The full set of delivery-address inputs + a Google Maps pin picker. Mobile-
 * first: single column on phones, two columns from sm up. Errors are surfaced
 * by the parent next to the relevant field via the `errors` map.
 */
export function AddressFields({
  value,
  onChange,
  showLabel = true,
  errors = {},
}: {
  value: AddressFormValue;
  onChange: (v: AddressFormValue) => void;
  showLabel?: boolean;
  errors?: Partial<Record<keyof AddressFormValue, string>>;
}) {
  const set = (patch: Partial<AddressFormValue>) => onChange({ ...value, ...patch });
  const err = (k: keyof AddressFormValue) =>
    errors[k] ? <p className="mt-1 text-xs font-medium text-terracotta-dark">{errors[k]}</p> : null;

  return (
    <div className="space-y-3">
      {showLabel && (
        <div>
          <span className="block text-sm font-semibold text-espresso">Save as</span>
          <div className="mt-1.5 flex gap-2">
            {LABELS.map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => set({ label: l })}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                  value.label === l ? "bg-espresso text-cream" : "bg-oat text-espresso hover:bg-oat/70"
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-semibold text-espresso">
          Full name
          <input value={value.fullName} onChange={(e) => set({ fullName: e.target.value })} className={field} autoComplete="name" />
          {err("fullName")}
        </label>
        <label className="block text-sm font-semibold text-espresso">
          Phone
          <div className="mt-1">
            <PhoneInput value={value.phone} onChange={(phone) => set({ phone })} />
          </div>
          {err("phone")}
        </label>
      </div>

      <label className="block text-sm font-semibold text-espresso">
        Delivery address / street
        <input
          value={value.addressLine}
          onChange={(e) => set({ addressLine: e.target.value })}
          placeholder="Street, road, or area description"
          className={field}
          autoComplete="street-address"
        />
        {err("addressLine")}
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-semibold text-espresso">
          Building name / number
          <input value={value.building} onChange={(e) => set({ building: e.target.value })} className={field} />
          {err("building")}
        </label>
        <label className="block text-sm font-semibold text-espresso">
          Area
          <input value={value.area} onChange={(e) => set({ area: e.target.value })} placeholder="e.g. Downtown" className={field} />
          {err("area")}
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-semibold text-espresso">
          Floor
          <input value={value.floor} onChange={(e) => set({ floor: e.target.value })} className={field} />
        </label>
        <label className="block text-sm font-semibold text-espresso">
          Apartment / office
          <input value={value.apartment} onChange={(e) => set({ apartment: e.target.value })} className={field} />
        </label>
      </div>

      <label className="block text-sm font-semibold text-espresso">
        Nearby landmark <span className="font-normal text-charcoal/50">(optional)</span>
        <input value={value.landmark} onChange={(e) => set({ landmark: e.target.value })} className={field} />
      </label>

      <label className="block text-sm font-semibold text-espresso">
        Delivery instructions <span className="font-normal text-charcoal/50">(optional)</span>
        <textarea
          value={value.instructions}
          onChange={(e) => set({ instructions: e.target.value })}
          rows={2}
          placeholder="e.g. Ring the bell, leave at the door"
          className={field}
        />
      </label>

      <MapPicker lat={value.lat} lng={value.lng} onChange={({ lat, lng }) => set({ lat, lng })} />
    </div>
  );
}
