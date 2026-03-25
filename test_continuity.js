// Simulation of the fixed logic
function calculateOffset(params) {
    const { faseIni,fecha_inicio_patron, created_at, fechaBaseStr, cicloLength } = params;
    
    const [cy, cm, cd] = fechaBaseStr.split('T')[0].split('-').map(Number);
    const fechaBase = new Date(cy, cm - 1, cd);
    
    // logic from service:
    const anchorDateStr = fecha_inicio_patron || 
                         (created_at ? created_at.split('T')[0].substring(0, 8) + '01' : '2026-03-01');
    
    const [ay, am, ad] = anchorDateStr.split('-').map(Number);
    const anchorDate = new Date(ay, am - 1, ad);
    anchorDate.setHours(0, 0, 0, 0);
    
    const diffTime = fechaBase.getTime() - anchorDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    const offsetPersonalizado = ((faseIni + diffDays) % cicloLength + cicloLength) % cicloLength;
    
    return { anchorDateStr, diffDays, offsetPersonalizado };
}

const CICLO_LENGTH = 6; // 2D-2N-2Z

// Case: Daniel (March cuadrado with fase_inicial: 1)
const danielMarch = {
    faseIni: 1,
    fecha_inicio_patron: null,
    created_at: "2026-03-03T07:18:43.569",
    fechaBaseStr: "2026-03-01T00:00:00",
    cicloLength: CICLO_LENGTH
};

const resMarch = calculateOffset(danielMarch);
console.log("March Daniel:", resMarch);
// Expected: offset 1 (DIA 2nd day). Correct, March 1 was Sunday, image shows D for Sunday? 
// Wait, March 11 was Wednesday and it was Z. 
// If March 1 was Phase 1:
// 1(Sun):1, 2(Mon):2, 3(Tue):3, 4(Wed):4, 5(Thu):5, 6(Fri):0, 7(Sat):1, 8(Sun):2, 9(Mon):3, 10(Tue):4, 11(Wed):5 (Z)
// Correct!

const danielApril = {
    faseIni: 1,
    fecha_inicio_patron: null,
    created_at: "2026-03-03T07:18:43.569",
    fechaBaseStr: "2026-04-01T00:00:00",
    cicloLength: CICLO_LENGTH
};

const resApril = calculateOffset(danielApril);
console.log("April Daniel:", resApril);
// March 1st to April 1st is 31 days.
// (1 + 31) % 6 = 32 % 6 = 2.
// Phase 2 is NOCHE (1st night).
// March 31 was Phase (1+30)%6 = 31%6 = 1 (DIA).
// So April 1 SHOULD be NOCHE.
// Result: offsetPersonalizado: 2. CORRECT!
