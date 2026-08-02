import { useTempleMaterials } from '../materials';
import { Smoke } from '../Smoke';
import { Shell } from './Shell';
import { Pillars } from './Pillars';
import { Ceiling } from './Ceiling';
import { ThroneDais } from './ThroneDais';
import { Altar } from './Altar';
import { Censer } from './Censer';
import { Lanterns } from './Lanterns';
import { HangingLamps } from './HangingLamps';
import { DoorPlaque } from './DoorPlaque';
import { GateExterior } from './GateExterior';

/** 整座廟：全部由 three.js 內建幾何體程序組成，零外部模型 */
export function Temple() {
  const m = useTempleMaterials();

  return (
    <group>
      <Shell m={m} />
      <Pillars m={m} />
      <Ceiling m={m} />
      <ThroneDais m={m} />
      <Altar m={m} />
      <Censer m={m} />
      <Smoke />
      <Lanterns m={m} />
      <HangingLamps m={m} />
      <DoorPlaque />
      <GateExterior m={m} />
    </group>
  );
}
