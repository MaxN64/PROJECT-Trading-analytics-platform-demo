import React from "react";

/** Такой же iframe, как в EconCalendarWithChart (без левой панели) */
function TvLiteChart({
  symbol = "SPX500USD",
  interval = "5",
  theme = "dark",
  height = 420,
}) {
  const url =
    "https://s.tradingview.com/widgetembed/?" +
    [
      `frameElementId=tv_${encodeURIComponent(symbol)}_${interval}`,
      `symbol=${encodeURIComponent(symbol)}`,
      `interval=${encodeURIComponent(interval)}`,
      // поведение как в твоём индикаторе
      // (если захочешь кнопки сверху — поменяй на hidetoptoolbar=0)
      "hidetoptoolbar=1",
      "symboledit=1",
      "saveimage=0",
      "toolbarbg=f1f3f6",
      "studies=[]",
      `theme=${encodeURIComponent(theme)}`,
      "style=1",
      "timezone=Etc/UTC",
      "studies_overrides={}",
      "overrides={}",
      "enabled_features=[]",
      "disabled_features=[]",
      "locale=ru",
    ].join("&");

  return (
    <div className="rounded-xl overflow-hidden border border-[var(--border)]">
      <iframe
        title={`TV ${symbol} ${interval}`}
        src={url}
        width="100%"
        height={height}
        frameBorder="0"
        allowTransparency={true}
        marginWidth="0"
        marginHeight="0"
        style={{ border: "none" }}
      />
    </div>
  );
}

/** Два «лайт»-графика: 5м и 15м, как в твоём правом блоке */
export default function DualSpxChartsWidgetEmbed({
  symbol = "SPX500USD",   // можно "CME_MINI:ES1!"
  theme = "dark",
  height = 420,
}) {
  return (
    <div className="grid grid-cols-2 gap-3 w-full md:grid-cols-2 sm:grid-cols-1">
      <TvLiteChart symbol={symbol} interval="15"  theme={theme} height={height} />
      <TvLiteChart symbol={symbol} interval="60" theme={theme} height={height} />
    </div>
  );
}
