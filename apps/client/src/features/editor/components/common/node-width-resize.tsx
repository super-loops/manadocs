import { memo, useCallback, useState } from 'react';
import { Slider } from '@mantine/core';

export type ImageWidthProps = {
  onChange: (value: number) => void;
  value: number;
  width?: string;
};

export const NodeWidthResize = memo(({ onChange, value, width }: ImageWidthProps) => {
  // 드래그 중에는 로컬 값이 슬라이더를 움직이고, 바깥 value 가 바뀌면 거기에
  // 맞춘다. effect 대신 렌더 중 리셋 — 화면에 옛 값이 한 프레임 비치지 않는다.
  const [currentValue, setCurrentValue] = useState(value);
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    setCurrentValue(value);
  }

  const handleChangeEnd = useCallback(
    (newValue: number) => {
      onChange(newValue);
    },
    [onChange]
  );

  return (
    <Slider
      p={'sm'}
      min={10}
      value={currentValue}
      onChange={setCurrentValue}
      onChangeEnd={handleChangeEnd}
      w={width || 100}
      label={(value) => `${value}%`}
    />
  );
});
