import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Icon } from '@/components/common/Icon';
import { Checkbox } from '@/components/forms/Checkbox';
import { TextField } from '@/components/forms/TextField';
import { ROUTES } from '@/constants/routes';
import { HOME_COPY } from '@/data/content';
import { useClickOutside } from '@/hooks/useClickOutside';
import { normalizeText, todayIso } from '@/utils/format';
import { AIRPORTS, airportLabel, type Airport } from './airports';

function AirportField({ label, placeholder, icon, value, onChange, error }: {
  label: string;
  placeholder: string;
  icon: 'planeUp' | 'planeDown';
  value: Airport | null;
  onChange: (a: Airport | null) => void;
  error?: string;
}) {
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useClickOutside<HTMLDivElement>(() => setOpen(false), open);
  const options = useMemo(() => {
    const q = normalizeText(text);
    return AIRPORTS.filter((a) => !q || normalizeText(`${a.city} ${a.code} ${a.name}`).includes(q));
  }, [text]);

  return (
    <div ref={ref} className="relative">
      <TextField
        label={label}
        placeholder={placeholder}
        icon={<Icon name={icon} size={20} />}
        value={open ? text : value ? airportLabel(value) : ''}
        onFocus={() => {
          setText('');
          setOpen(true);
        }}
        onChange={(e) => {
          setText(e.target.value);
          onChange(null);
        }}
        error={error}
        autoComplete="off"
      />
      {open && (
        <ul className="absolute left-0 right-0 top-[calc(100%+8px)] z-dropdown max-h-72 overflow-auto rounded-lg border border-gray-100 bg-white py-1 shadow-dropdown">
          {options.length === 0 && <li className="px-5 py-3 text-sm text-gray-500">Không tìm thấy sân bay</li>}
          {options.map((a) => (
            <li key={a.code}>
              <button
                type="button"
                className="flex w-full items-center justify-between px-5 py-3 text-left hover:bg-gray-50 !shadow-none !rounded-none"
                onClick={() => {
                  onChange(a);
                  setOpen(false);
                }}
              >
                <span className="text-gray-900">{a.city}</span>
                <span className="text-sm text-gray-500">
                  {a.name} · {a.code}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Flight search: trip type, airports, dates, passengers. */
export function FlightSearchForm() {
  const navigate = useNavigate();
  const [roundTrip, setRoundTrip] = useState(false);
  const [cheapest, setCheapest] = useState(false);
  const [from, setFrom] = useState<Airport | null>(null);
  const [to, setTo] = useState<Airport | null>(null);
  const [depart, setDepart] = useState(todayIso());
  const [ret, setRet] = useState(todayIso());
  const [pax, setPax] = useState({ adults: 1, children: 0, infants: 0 });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const found: Record<string, string> = {};
    if (!from) found.from = 'Vui lòng chọn điểm đi';
    if (!to) found.to = 'Vui lòng chọn điểm đến';
    if (from && to && from.code === to.code) found.to = 'Điểm đến phải khác điểm đi';
    if (!depart || depart < todayIso()) found.depart = 'Ngày đi không hợp lệ';
    if (roundTrip && ret < depart) found.ret = 'Ngày về phải sau ngày đi';
    if (pax.infants > pax.adults) found.pax = 'Số em bé không vượt quá số người lớn';
    setErrors(found);
    if (Object.keys(found).length) return;
    const p = new URLSearchParams({
      from: from!.code,
      to: to!.code,
      depart,
      ...(roundTrip ? { return: ret } : {}),
      adults: String(pax.adults),
      children: String(pax.children),
      infants: String(pax.infants),
    });
    navigate(`${cheapest ? ROUTES.flightCheapest : ROUTES.flightResult}?${p}`);
  };

  const paxField = (key: keyof typeof pax, label: string, min: number) => (
    <TextField
      label={label}
      type="number"
      min={min}
      max={9}
      icon={<Icon name="user" size={20} />}
      value={pax[key]}
      onChange={(e) => setPax((p) => ({ ...p, [key]: Math.min(9, Math.max(min, Number(e.target.value) || 0)) }))}
    />
  );

  return (
    <Card className="mx-auto flex w-[95%] flex-col gap-6 p-4 lg:w-full lg:max-w-[1216px] lg:px-6 lg:pb-6 lg:pt-10">
      <div className="flex flex-col items-center gap-2 text-center lg:gap-4">
        <h4 className="m-0 text-2xl leading-8 lg:text-[36px] lg:leading-[44px]">{HOME_COPY.flight.title}</h4>
        <p className="lg">{HOME_COPY.flight.description}</p>
      </div>
      <form onSubmit={submit} noValidate className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex gap-6" role="radiogroup" aria-label="Loại vé">
            <Checkbox shape="round" label="Một chiều" checked={!roundTrip} onChange={() => setRoundTrip(false)} />
            <Checkbox shape="round" label="Khứ hồi" checked={roundTrip} onChange={() => setRoundTrip(true)} />
          </div>
          <Checkbox label="Vé rẻ nhất tháng" checked={cheapest} onChange={setCheapest} />
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <AirportField label="Điểm đi" placeholder="Vui lòng nhập điểm đi" icon="planeUp" value={from} onChange={setFrom} error={errors.from} />
          <AirportField label="Điểm đến" placeholder="Vui lòng nhập điểm đến" icon="planeDown" value={to} onChange={setTo} error={errors.to} />
          <TextField label="Ngày đi" type="date" min={todayIso()} value={depart} onChange={(e) => setDepart(e.target.value)} icon={<Icon name="calendar" size={20} />} error={errors.depart} />
          {roundTrip && (
            <TextField label="Ngày về" type="date" min={depart} value={ret} onChange={(e) => setRet(e.target.value)} icon={<Icon name="calendar" size={20} />} error={errors.ret} />
          )}
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
          {paxField('adults', 'Người lớn', 1)}
          {paxField('children', 'Trẻ em', 0)}
          {paxField('infants', 'Em bé', 0)}
          <Button type="submit" fullWidth>
            Tìm chuyến bay
          </Button>
        </div>
        {errors.pax && <p className="sm text-error">{errors.pax}</p>}
      </form>
    </Card>
  );
}
