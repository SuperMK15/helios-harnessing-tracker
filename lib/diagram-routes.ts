// Coordinates in the detailed schematic's native 2048 × 1219 image.
export const diagramRoutes: Record<string, string> = {
  "PWR-01": "M1619 128 H1649 V140 H1795 M1619 166 H1649 V155 H1795",
  "PWR-02": "M1069 139 L1544 137 M1069 155 H1544",
  "PWR-03": "M1034 219 V232 H1087 V295 M1052 219 V225 H1110 V295",
  "PWR-04": "M1088 350 V374 H918 V605 H980 M1108 350 V381 H932 V593 H980",
  "AVN-01": "M1069 192 H1163 V388 H1247 V378 M1069 205 H1157 V381 H1232 V378",
  "AVN-02": "M1084 470 V395 H1255 V378 M1092 470 V402 H1263 V378 M1100 470 V409 H1271 V378 M1108 470 V416 H1279 V378",
  "AVN-03": "M1145 470 V436 H1386 V378 M1153 470 V442 H1394 V378 M1161 470 V449 H1402 V378 M1169 470 V456 H1410 V378",
  "AVN-04": "M1245 516 H1408 M1245 530 H1408 M1245 543 H1408 M1245 557 H1408",
  "AVN-05": "M1245 585 H1360 V613 H1904 V620 H1921 M1245 599 H1347 V620 H1898 V633 H1921 M1245 613 H1334 V627 H1890 V646 H1921 M1245 627 H1320 V633 H1884 V660 H1921",
  "AVN-06": "M1489 401 H1557 V212 M1489 412 H1571 V212 M1489 425 H1585 V212 M1489 438 H1599 V212",
  "PRP-01": "M690 45 H705 V41 H790 V33 H1010 V103 M690 55 H705 V51 H981 V103",
  "SNS-03": "M1853 666 H1874 V673 H1921 M1853 680 H1880 V687 H1921 M1853 694 H1887 V701 H1921 M1853 708 H1893 V714 H1921",
  "SNS-04": "M1853 743 H1887 V729 H1921 M1853 757 H1894 V743 H1921 M1853 771 H1901 V756 H1921 M1853 784 H1907 V770 H1921",
};
function parallel(id: string, x1: number, x2: number, ys: number[]) {
  diagramRoutes[id] = ys.map(y => `M${x1} ${y} H${x2}`).join(" ");
}
parallel("SNS-01",1489,1611,[489,502,516,530]);
parallel("SNS-02",1612,1748,[489,502,516,530]);
parallel("SNS-05",1727,1921,[837,851,865,879]);
parallel("SNS-06",1523,1726,[837,851,865,879]);
// The source image draws the rangefinder continuously across its center-wing disconnect.
parallel("SNS-07",1286,1366,[687,700,714,728]);
parallel("SNS-08",1368,1448,[687,700,714,728]);
function id(prefix: string, n: number) { return prefix + "-" + String(n).padStart(2,"0"); }
parallel("PRP-02",324,604,[45,67,88]);
diagramRoutes["PRP-03"] = "M690 88 H834 V545 H980";
[ [138,152,816,830,103,126], [236,254,871,898,160,174], [339,356,952,981,212,219], [441,458,878,891,361,368] ].forEach(([a,b,x,u,y,v],i) => {
  const start = 4+i*4;
  diagramRoutes[id("PRP",start)] = `M690 ${a} H${x} V${y} H${i===3?1000:952}${i===3?" V219":""} M690 ${b} H${u} V${v} H${i===3?1028:i===2?981:952}${i===3?" V219":""}`;
  const phase = [148,249,351,454][i];
  parallel(id("PRP",start+1),324,604,[phase,phase+21,phase+43]);
  parallel(id("PRP",start+2),324,604,[[206,309,411,512][i]]);
  parallel(id("PRP",start+3),690,834,[[191,293,394,497][i]]);
});
// Signal, power, and ground centerlines measured on the original schematic.
const servoBundles = [
  { firstRun: 1, xs: [354, 368, 381], ys: [619, 626, 633] },
  { firstRun: 2, xs: [476, 490, 504], ys: [646, 653, 660] },
  { firstRun: 4, xs: [544, 558, 572], ys: [673, 680, 687] },
  { firstRun: 6, xs: [653, 667, 680], ys: [701, 708, 714] },
  { firstRun: 9, xs: [721, 735, 748], ys: [728, 735, 741] },
  { firstRun: 12, xs: [789, 803, 816], ys: [755, 762, 769] },
  { firstRun: 15, xs: [857, 871, 884], ys: [782, 789, 796] },
];

for (const { firstRun, xs, ys } of servoBundles) {
  diagramRoutes[id("SRV", firstRun)] = xs.map((x, i) => `M980 ${ys[i]} H${x} V871`).join(" ");
  if (firstRun === 1) continue; // The wheel servo has no inline disconnect.
  const reachesTail = firstRun >= 6;
  diagramRoutes[id("SRV", firstRun + 1)] = xs.map(x => `M${x} 926 V${reachesTail ? 999 : 958}`).join(" ");
  if (reachesTail) {
    diagramRoutes[id("SRV", firstRun + 2)] = xs.map(x => `M${x} 1054 V1128`).join(" ");
  }
}
