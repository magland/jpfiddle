/* eslint-disable @typescript-eslint/no-explicit-any */
import { FunctionComponent } from "react";
import { Fiddle } from "./JpfiddleContext/JpfiddleContext";


type TopBarProps = {
  width: number
  height: number
  cloudFiddle: Fiddle | undefined
  fiddleUri?: string
}

const TopBar: FunctionComponent<TopBarProps> = ({cloudFiddle}) => {
  return (
    <div>
      jpfiddle - {cloudFiddle?.jpfiddle?.title}
    </div>
  )
}

export default TopBar;
