import { useMemo } from "react";

export default function useComputedPosition({ maxLoss, pricePerPoint, stopPoints, tpPoints }) {
  const num = (v) => {
    const n = Number(String(v).replace(",", "."));
    return Number.isFinite(n) ? n : NaN;
  };

  return useMemo(() => {
    const maxLossN = num(maxLoss);
    const pricePerPointN = num(pricePerPoint);
    const stopPointsN = num(stopPoints);
    const tpPointsN = num(tpPoints);

    const valid =
      maxLossN > 0 &&
      pricePerPointN > 0 &&
      stopPointsN > 0 &&
      Number.isFinite(maxLossN) &&
      Number.isFinite(pricePerPointN) &&
      Number.isFinite(stopPointsN);

    const perContractRisk = valid ? stopPointsN * pricePerPointN : NaN;
    const raw =
      valid && perContractRisk > 0 ? Math.floor(maxLossN / perContractRisk) : 0;
    const contracts = Math.max(0, raw);

    const totalRisk = valid ? contracts * perContractRisk : NaN;
    const leftover = valid ? Math.max(0, maxLossN - totalRisk) : NaN;

    const perContractProfit =
      valid && Number.isFinite(tpPointsN) ? tpPointsN * pricePerPointN : NaN;
    const totalProfit = valid ? contracts * perContractProfit : NaN;

    const rr = Number.isFinite(tpPointsN) && stopPointsN > 0 ? tpPointsN / stopPointsN : NaN;

    return {
      valid,
      contracts,
      perContractRisk,
      totalRisk,
      leftover,
      perContractProfit,
      totalProfit,
      rr,
      stopPointsN,
      pricePerPointN,
    };
  }, [maxLoss, pricePerPoint, stopPoints, tpPoints]);
}
