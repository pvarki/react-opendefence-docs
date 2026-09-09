import { useTranslation } from "react-i18next";
import { Minus, Plus, RotateCcw } from "lucide-react";
import {
  TransformComponent,
  TransformWrapper,
  useControls,
} from "react-zoom-pan-pinch";

function Controls() {
  const { t } = useTranslation();
  const { zoomIn, zoomOut, resetTransform } = useControls();
  const button =
    "rounded-md border border-border bg-card/90 p-1.5 text-muted-foreground backdrop-blur hover:text-foreground";

  return (
    <div className="absolute top-2 left-2 z-10 flex gap-1">
      <button
        type="button"
        onClick={() => zoomIn()}
        aria-label={t("blocks.zoomIn")}
        className={button}
      >
        <Plus className="size-4" />
      </button>
      <button
        type="button"
        onClick={() => zoomOut()}
        aria-label={t("blocks.zoomOut")}
        className={button}
      >
        <Minus className="size-4" />
      </button>
      <button
        type="button"
        onClick={() => resetTransform()}
        aria-label={t("blocks.zoomReset")}
        className={button}
      >
        <RotateCcw className="size-4" />
      </button>
    </div>
  );
}

export default function DiagramZoom({ svg }: { svg: string }) {
  return (
    <TransformWrapper
      minScale={0.25}
      maxScale={8}
      centerOnInit
      doubleClick={{ mode: "reset" }}
    >
      <Controls />
      <TransformComponent
        wrapperClass="!h-full !w-full"
        contentClass="!h-full !w-full items-center justify-center"
      >
        <div
          className="[&_svg]:max-w-none! [&_svg]:h-auto"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </TransformComponent>
    </TransformWrapper>
  );
}
