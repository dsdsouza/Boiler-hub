import { FillLoader, type FillLoaderProps } from "./FillLoader";
import { HOT_VALVE_CYCLE_SECONDS } from "@/components/boiler/geometry";

export function ValveLoader(props: FillLoaderProps) {
  return <FillLoader {...props} shape="valve" motionSeconds={HOT_VALVE_CYCLE_SECONDS * 2} />;
}
