import { useEffect, useState } from "react";
import { CONTRACT_PRESETS } from "../lib/contracts";

const KEY = "mes-calc-settings";

export default function useSettings() {
  const [contract, setContract] = useState("MES");
  const [maxLoss, setMaxLoss] = useState("300");
  const [pricePerPoint, setPricePerPoint] = useState(String(CONTRACT_PRESETS.MES.pricePerPoint));
  const [tpPoints, setTpPoints] = useState("70");
  const [dayRiskLimit, setDayRiskLimit] = useState("600");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return;
      const obj = JSON.parse(raw);
      if (obj.contract) setContract(obj.contract);
      if (obj.maxLoss != null) setMaxLoss(String(obj.maxLoss));
      if (obj.pricePerPoint != null) setPricePerPoint(String(obj.pricePerPoint));
      if (obj.tpPoints != null) setTpPoints(String(obj.tpPoints));
      if (obj.dayRiskLimit != null) setDayRiskLimit(String(obj.dayRiskLimit));
    } catch {}
  }, []);

  useEffect(() => {
    localStorage.setItem(
      KEY,
      JSON.stringify({ contract, maxLoss, pricePerPoint, tpPoints, dayRiskLimit })
    );
  }, [contract, maxLoss, pricePerPoint, tpPoints, dayRiskLimit]);

  // при смене контракта подставляем дефолтную цену пункта
  useEffect(() => {
    const p = CONTRACT_PRESETS[contract];
    if (p) setPricePerPoint(String(p.pricePerPoint));
  }, [contract]);

  return {
    contract, setContract,
    maxLoss, setMaxLoss,
    pricePerPoint, setPricePerPoint,
    tpPoints, setTpPoints,
    dayRiskLimit, setDayRiskLimit,
  };
}
