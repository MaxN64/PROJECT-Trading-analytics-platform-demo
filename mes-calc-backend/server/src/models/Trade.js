import mongoose from "mongoose";

const TradeSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Types.ObjectId, index: true, required: true },

    // основная хронология
    createdAt: { type: Date, default: () => new Date(), index: true },
    updatedAt: { type: Date, default: () => new Date() },

    // локальные признаки времени
    localTz: String,
    localHour: { type: Number, index: true }, // 0..23
    nyHour:    { type: Number, index: true }, // 0..23

    // ручные поля
    stopPoints: Number,
    pricePerPoint: Number,
    perContractRisk: Number,
    contracts: Number,
    totalRisk: Number,
    isProfit: { type: Boolean, index: true },

    conditions: [{ type: String, index: true }],
    conditionsLabels: [String],

    tags: [{ type: String, index: true }],
    comment: String,

    // вложения
    images: [{ type: mongoose.Types.ObjectId, index: true }],
    screenshotId: { type: mongoose.Types.ObjectId, index: true },
    voiceNoteId: { type: mongoose.Types.ObjectId, index: true },

    // ===== импорт из VolFix =====
    source: { type: String, index: true },     // "volfix"
    instrument: { type: String, index: true }, // "ES" | "MES" | …
    side: String,                               // BUY / SELL
    size: Number,
    pnl: Number,                                // P&L $$
    fee: Number,
    netR: Number,                               // результат в R

    openPrice: Number,
    closePrice: Number,
    openDate: Date,
    closeDate: Date,

    // дополнительные поля из CSV выписки
    pips: Number,
    drawdown: Number,
    drawdownCash: Number,

    // анти-дубли
    externalKey: { type: String, index: true, sparse: true },
    openOrderId: String,
    closeOrderId: String,

    // ====== ПОЛЯ МЕТРИК из Volume Journal (сохраняем в сделку) ======
    // (имена оставил 1-в-1 как вы присылаете с фронта)
    'vj_in_value_area': Boolean,
    'vj_va_edge_dist_ticks': Number,
    'vj_is_HVN': Boolean,
    'vj_is_LVN': Boolean,
    'vj_vol_pctile': Number,
    'vj_delta_agg': Number,
    'vj_delta_rank': Number,
    'vj_delta_opposes_side': Boolean,
    'vj_edge_slope': Number,
    'vj_thin_behind': Boolean,
    'vj_vol_es_equiv': Number,
    'vj_p70_es': Number,
    'vj_poc': Number,
    'vj_val': Number,
    'vj_vah': Number,
    'vj_level_score': Number,
    'vj_flags': [String],

    // служебные метки для понимания когда и что применяли
    'vj_calc_date': String,    // "YYYY-MM-DD" от CSV
    'vj_apply_mode': { type: String, enum: ['FADE','BREAKOUT'], default: 'FADE' },
  },
  { timestamps: true }
);

// анти-дубли по внешнему ключу в рамках юзера
TradeSchema.index({ userId: 1, externalKey: 1 }, { unique: true, sparse: true });

// полезные индексы
TradeSchema.index({ userId: 1, createdAt: -1 });
TradeSchema.index({ userId: 1, netR: 1 });

// актуализируем updatedAt на любом обновлении (если не используете timestamps)
TradeSchema.pre('findOneAndUpdate', function(next){
  this.set({ updatedAt: new Date() });
  next();
});

export default mongoose.model("Trade", TradeSchema);
