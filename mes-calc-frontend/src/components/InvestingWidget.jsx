// src/components/InvestingEmbed.jsx
import React from "react";
import styles from "./InvestingWidget.module.css";

export default function InvestingEmbed() {
  return (
    <div className={styles.frameBox}>
      <iframe
        src="https://sslecal2.investing.com?ecoDayBackground=%230606c2&defaultFont=%23000000&innerBorderColor=%230f0896&borderColor=%230b2099&ecoDayFontColor=%23000000&columns=exc_flags,exc_currency,exc_importance,exc_actual,exc_forecast,exc_previous&category=_employment,_economicActivity,_inflation,_credit,_centralBanks,_confidenceIndex,_balance,_Bonds&importance=3&features=datepicker,timezone,timeselector,filters&countries=4,17,39,72,6,37,5,22,12,35&calType=day&timeZone=16&lang=7"
        width="100%"
        height="400"
        frameBorder="0"
        allowTransparency="true"
        marginWidth="0"
        marginHeight="0"
        title="Investing.com calendar"
      ></iframe>

      <div className={styles.powered}>
        Экономический календарь от{" "}
        <a
          href="https://ru.investing.com/"
          rel="nofollow"
          target="_blank"
        >
          Investing.com
        </a>
      </div>
    </div>
  );
}
