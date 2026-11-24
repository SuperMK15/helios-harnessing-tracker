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
[354,477,545,640,708,776,844].forEach((x,i) => {
  const n = [1,2,4,6,9,12,15][i];
  const y = [619,646,673,701,728,755,782][i];
  diagramRoutes[id("SRV",n)] = [0,1,2].map(j => `M980 ${y+j*7} H${x+j*13.5} V${i?899:871}`).join(" ");
  if(i) diagramRoutes[id("SRV",n+1)] = [0,1,2].map(j => `M${x+j*13.5} 900 V${i<3?959:1027}`).join(" ");
  if(i>=3) diagramRoutes[id("SRV",n+2)] = [0,1,2].map(j => `M${x+j*13.5} 1028 V1129`).join(" ");
});
