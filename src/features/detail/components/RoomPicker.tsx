import { useState } from 'react';
import { Button } from '@/components/common/Button';
import { Icon } from '@/components/common/Icon';
import { Stepper } from '@/components/common/Stepper';
import type { Room } from '@/types/models';
import { cdnImage } from '@/utils/assets';
import { formatNumber } from '@/utils/format';
import { RoomModal } from './RoomModal';

interface RoomPickerProps {
  rooms: Room[];
  /** Price unit under each room price (KHÁCH for ships, PHÒNG for hotels). */
  unit: string;
  roomFeatureLabels: (room: Room) => string[];
  allowRentWhole: boolean;
  onBook: (selection: { room: Room; quantity: number }[], total: number) => void;
  onRentWhole: () => void;
}

export const roomPrice = (r: Room) => (r.salePrice > 0 && r.salePrice < r.price ? r.salePrice : r.price);

/** Room list with quantity steppers, running total and booking actions. */
export function RoomPicker({ rooms, unit, roomFeatureLabels, allowRentWhole, onBook, onRentWhole }: RoomPickerProps) {
  const [qty, setQty] = useState<Record<string, number>>({});
  const [openRoom, setOpenRoom] = useState<Room | null>(null);
  const setRoomQty = (id: string, n: number) => setQty((q) => ({ ...q, [id]: n }));

  const total = rooms.reduce((sum, r) => sum + roomPrice(r) * (qty[r.id] ?? 0), 0);
  const selection = rooms.filter((r) => (qty[r.id] ?? 0) > 0).map((room) => ({ room, quantity: qty[room.id] }));

  if (rooms.length === 0) {
    return <p className="md">Hiện chưa có thông tin phòng. Vui lòng liên hệ hotline để được tư vấn.</p>;
  }

  return (
    <div className="section-bg flex flex-col gap-4 rounded-[32px] bg-gray-100 p-4 [background-blend-mode:multiply] lg:gap-5 lg:p-8">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" iconLeft={<Icon name="close" size={16} />} onClick={() => setQty({})}>
          Xoá lựa chọn
        </Button>
      </div>
      {rooms.map((r) => (
        <div key={r.id} className="flex flex-col gap-4 rounded-[32px] border border-gray-200 bg-white p-4 shadow-sm md:flex-row md:items-center md:gap-5 md:p-5">
          <div className="flex flex-1 items-center gap-5">
            <img src={cdnImage(r.images[0])} alt="" loading="lazy" className="h-[76px] w-[76px] shrink-0 rounded-xl object-cover" />
            <div className="flex min-w-0 flex-col items-start gap-2">
              <button type="button" onClick={() => setOpenRoom(r)} className="text-left text-base font-bold leading-6 text-gray-900 underline !shadow-none hover:text-primary-dark">
                {r.title}
              </button>
              <div className="flex items-center gap-5 text-sm text-gray-600">
                {r.size && (
                  <span className="flex items-center gap-2">
                    <Icon name="bed" size={20} /> {r.size} m²
                  </span>
                )}
                {r.maxPersons && (
                  <span className="flex items-center gap-1">
                    Tối đa: {r.maxPersons} <Icon name="user" size={14} />
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between gap-5">
            <div className="flex flex-col">
              {r.salePrice > 0 && r.salePrice < r.price && (
                <span className="text-xs text-gray-400 line-through">{formatNumber(r.price)} đ</span>
              )}
              <span className="text-lg font-bold leading-7 text-primary-dark">{formatNumber(roomPrice(r))} đ</span>
              <span className="text-xs font-semibold uppercase leading-4 text-gray-400">/{unit}</span>
            </div>
            <Stepper value={qty[r.id] ?? 0} onChange={(n) => setRoomQty(r.id, n)} label={`số lượng ${r.title}`} />
          </div>
        </div>
      ))}
      <div className="flex flex-col gap-4 pt-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="sm text-gray-600">Tổng tiền</p>
          <p className="text-xl font-bold leading-[30px] text-primary-dark" aria-live="polite">
            {formatNumber(total)} đ
          </p>
        </div>
        <div className="flex gap-4">
          {allowRentWhole && (
            <Button variant="outline" onClick={onRentWhole}>
              Thuê trọn tàu
            </Button>
          )}
          <Button iconRight={<Icon name="arrowRight" />} onClick={() => onBook(selection, total)}>
            Đặt ngay
          </Button>
        </div>
      </div>
      <RoomModal
        room={openRoom}
        quantity={openRoom ? qty[openRoom.id] ?? 0 : 0}
        featureLabels={openRoom ? roomFeatureLabels(openRoom) : []}
        onClose={() => setOpenRoom(null)}
        onConfirm={(n) => openRoom && setRoomQty(openRoom.id, n)}
      />
    </div>
  );
}
