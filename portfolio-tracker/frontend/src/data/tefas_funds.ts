export interface TefasFund {
    symbol: string;
    name: string;
}

export const TEFAS_FUNDS: TefasFund[] = [
    { symbol: "MAC", name: "MARMARA CAPITAL PORTFÖY HİSSE SENEDİ FONU (HİSSE YOĞUN FON)" },
    { symbol: "TCD", name: "TACİRLER PORTFÖY DEĞİŞKEN FON" },
    { symbol: "TI3", name: "İŞ PORTFÖY İŞ'TE KADIN HİSSE SENEDİ FONU (HİSSE YOĞUN FON)" },
    { symbol: "IPB", name: "İSTANBUL PORTFÖY BİRİNCİ DEĞİŞKEN FON" },
    { symbol: "NNF", name: "HEDEF PORTFÖY BİRİNCİ HİSSE SENEDİ FONU (HİSSE YOĞUN FON)" },
    { symbol: "IDH", name: "İŞ PORTFÖY BIST 100 DIŞI ŞİRKETLER HİSSE SENEDİ FONU (HİSSE YOĞUN FON)" },
    { symbol: "GMR", name: "İNVEO PORTFÖY İKİNCİ HİSSE SENEDİ FONU (HİSSE YOĞUN FON)" },
    { symbol: "YAS", name: "YAPI KREDİ PORTFÖY KOÇ HOLDİNG İŞTİRAK VE HİSSE SENEDİ FONU (HİSSE YOĞUN FON)" },
    { symbol: "HKH", name: "HEDEF PORTFÖY BIST 30 HİSSE SENEDİ FONU (HİSSE YOĞUN FON)" },
    { symbol: "AFT", name: "AK PORTFÖY YENİ TEKNOLOJİLER YABANCI HİSSE SENEDİ FONU" },
    { symbol: "YAY", name: "YAPI KREDİ PORTFÖY YABANCI TEKNOLOJİ SEKTÖRÜ HİSSE SENEDİ FONU" },
    { symbol: "DBH", name: "DENİZ PORTFÖY BIST 100 ENDEKSİ HİSSE SENEDİ FONU (HİSSE YOĞUN FON)" },
    { symbol: "BIO", name: "AK PORTFÖY SAĞLIK SEKTÖRÜ YABANCI HİSSE SENEDİ FONU" },
    { symbol: "GUH", name: "GARANTİ PORTFÖY YABANCI TEKNOLOJİ HİSSE SENEDİ FONU" },
    { symbol: "TGE", name: "İŞ PORTFÖY EMTİA YABANCI BYF FON SEPETİ FONU" },
    { symbol: "KZL", name: "KUVEYT TÜRK PORTFÖY ALTIN KATILIM FONU" },
    { symbol: "GTA", name: "GARANTİ PORTFÖY ALTIN FONU" },
    { symbol: "TCA", name: "TACİRLER PORTFÖY ALTIN FONU" },
    { symbol: "IJV", name: "İSTANBUL PORTFÖY HİSSE SENEDİ FONU (HİSSE YOĞUN FON)" },
    { symbol: "MPK", name: "MÜKAFAT PORTFÖY KATILIM HİSSE SENEDİ FONU (HİSSE YOĞUN FON)" },
    { symbol: "TP2", name: "TERA PORTFÖY PARA PİYASASI (TL) FONU" },
];

// Helper to filter matching funds
export const searchTefasFunds = (query: string): TefasFund[] => {
    if (!query) return [];
    const lowerQ = query.toLocaleLowerCase('tr-TR');
    return TEFAS_FUNDS.filter(f => 
        f.symbol.toLocaleLowerCase('tr-TR').includes(lowerQ) || 
        f.name.toLocaleLowerCase('tr-TR').includes(lowerQ)
    );
};
