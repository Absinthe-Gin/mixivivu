import { useEffect, useState } from 'react';
import { Button } from '@/components/common/Button';
import { Icon } from '@/components/common/Icon';
import { Modal } from '@/components/common/Modal';
import { Stepper } from '@/components/common/Stepper';
import type { Room } from '@/types/models';
import { cdnImage } from '@/utils/assets';
import { cx } from '@/utils/cx';

interface RoomModalProps {
  room: Room | null;
  quantity: number;
  featureLabels: string[];
  onClose: () => void;
  onConfirm: (quantity: number) => void;
}

/** Room details: gallery, size, capacity, amenities and quantity picker. */
export function RoomModal({ room, quantity, featureLabels, onClose, onConfirm }: RoomModalProps) {
  const [image, setImage] = useState(0);
  const [qty, setQty] = useState(quantity);
  useEffect(() => {
    setImage(0);
    setQty(quantity);
  }, [room, quantity]);

  if (!room) return null;
  const images = room.images.length ? room.images : [''];

  return (
    <Modal open={!!room} onClose={onClose} ariaLabel={room.title} className="lg:!max-w-[970px] lg:!p-[28px] lg:!pl-[42px]">
      <div className="flex flex-col gap-6 lg:flex-row lg:gap-14">
        <div className="flex w-full flex-col gap-2 lg:w-[400px] lg:shrink-0">
          <img src={cdnImage(images[image])} alt={room.title} className="aspect-square w-full rounded-image object-cover" />
          <div className="flex justify-center gap-2">
            {images.slice(0, 5).map((src, i) => (
              <button
                key={src + i}
                type="button"
                aria-label={`Ảnh ${i + 1}`}
                onClick={() => setImage(i)}
                className={cx('h-[60px] w-[60px] overflow-hidden rounded-md border-2 !shadow-none', i === image ? 'border-primary' : 'border-transparent')}
              >
                <img src={cdnImage(src)} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-8 lg:pt-4">
          <h5 className="m-0 pr-8 text-2xl leading-8">{room.title}</h5>
          <div className="flex items-center gap-5 text-sm text-gray-600">
            {room.size && (
              <span className="flex items-center gap-2">
                <Icon name="bed" size={20} /> {room.size} m²
              </span>
            )}
            {room.maxPersons && (
              <span className="flex items-center gap-1">
                Tối đa: {room.maxPersons} <Icon name="user" size={14} />
              </span>
            )}
          </div>
          {featureLabels.length > 0 && (
            <ul className="grid grid-cols-2 gap-x-6 gap-y-5">
              {featureLabels.map((f) => (
                <li key={f} className="flex items-center gap-3 text-base text-gray-900">
                  <Icon name="check" size={20} className="shrink-0 text-primary" /> {f}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-auto flex items-center gap-5">
            <Stepper value={qty} onChange={setQty} label="số phòng" className="!border-gray-900 !border-2" />
            <Button
              onClick={() => {
                onConfirm(qty);
                onClose();
              }}
            >
              Chọn phòng
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
