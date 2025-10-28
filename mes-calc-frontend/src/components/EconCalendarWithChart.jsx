import React from "react";

const EconCalendarWithChart = ({ height = 420, widgetSrc, symbol = "CME_MINI:ES1!", interval = "60", theme = "dark" }) => {
  return (
    <div className="flex gap-2 w-full">
      {/* Левая часть — календарь */}
      <div className="flex-1">
        <iframe
          src={widgetSrc}
          width="100%"
          height={height}
          frameBorder="0"
          allowTransparency="true"
          marginWidth="0"
          marginHeight="0"
          style={{ border: "none", borderRadius: "8px" }}
          title="Investing Economic Calendar"
        ></iframe>
      </div>

      {/* Правая часть — график TradingView */}
      <div className="flex-1">
        <iframe
          src={`https://s.tradingview.com/widgetembed/?frameElementId=tradingview_es_chart&symbol=SPX500USD&interval=240&hidetoptoolbar=1&symboledit=1&saveimage=0&toolbarbg=f1f3f6&studies=[]&theme=${theme}&style=1&timezone=Etc/UTC&studies_overrides={}&overrides={}&enabled_features=[]&disabled_features=[]&locale=ru`}
          width="100%"
          height={height}
          frameBorder="0"
          allowTransparency="true"
          marginWidth="0"
          marginHeight="0"
          style={{ border: "none", borderRadius: "8px" }}
          title="ES Chart"
        ></iframe>
      </div>
    </div>
  );
};

export default EconCalendarWithChart;
