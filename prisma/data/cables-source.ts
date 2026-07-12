/**
 * Raw source data transcribed from the UMAX AUTO SPARES OPC PVT. LTD.
 * "Friction Free Cables OEM" price list. Each section is a vehicle/model
 * group; each item is one cable line (name carries type + compatibility,
 * mrp = printed MRP, price = D.P./Net Rate). Items with no printed price
 * in the source are omitted.
 */

export interface CableItem {
  name: string;
  mrp: number;
  price: number;
}

export interface CableSection {
  group: string;
  items: CableItem[];
}

export const CABLE_SECTIONS: CableSection[] = [
  {
    group: "CD-100 / SS / Sleek / Dawn",
    items: [
      { name: "Clutch Cable", mrp: 108, price: 34.5 },
      { name: "Throttle Cable", mrp: 99, price: 31.7 },
      { name: "Front Brake Cable", mrp: 138, price: 44.0 },
      { name: "Speedometer Cable CD 100/CBZ/Ambition/Amb-135", mrp: 99, price: 31.7 },
      { name: "Speedometer Cable CD Dawn Screw Type", mrp: 99, price: 31.7 },
      { name: "Speedometer Cable SS/Sleek", mrp: 99, price: 31.7 },
    ],
  },
  {
    group: "Splendor / Passion",
    items: [
      { name: "Clutch Cable Splendor/Splendor+/Splendor Pro/NXG/CD DLX/iSmart/Passion/Passion Pro/HF DLX/HF Dawn/Classic/Dawn", mrp: 105, price: 33.4 },
      { name: "Throttle Cable Splendor/Passion/Dawn/Spl+/Pass+/NXG/CD DlX", mrp: 97, price: 31.0 },
      { name: "Front Brake Cable Splendor/Passion/Dawn/Spl+/Pass+/NXG/CD DlX", mrp: 132, price: 42.2 },
      { name: "Choke Cable NXG/Achiver", mrp: 112, price: 35.9 },
      { name: "Seat Lock Cable Passion + Model", mrp: 50, price: 15.8 },
      { name: "Speedometer Cable Splendor Old/Passion Old", mrp: 99, price: 31.7 },
      { name: "Speedometer Cable Spl+/Passion+/CD DLX/Glamour Fi", mrp: 97, price: 31.0 },
      { name: "Speedometer Cable Splendor Pro/Passion Pro Digital Model", mrp: 97, price: 31.0 },
    ],
  },
  {
    group: "I-Smart 110cc",
    items: [
      { name: "Clutch Cable Splendor/Splendor+/Splendor Pro/NXG/CD DLX/iSmart/Passion/Passion Pro/HF DLX/HF Dawn/Classic/Dawn", mrp: 105, price: 33.4 },
      { name: "Throttle Cable I-Smart", mrp: 108, price: 34.5 },
      { name: "Front Brake Cable Splendor/Passion/Dawn/Spl+/Pass+/NXG/CD DlX", mrp: 132, price: 42.2 },
      { name: "Speedometer Cable Splendor i Smart", mrp: 105, price: 33.4 },
    ],
  },
  {
    group: "Passion X-Pro",
    items: [
      { name: "Clutch Cable", mrp: 136, price: 43.6 },
      { name: "Throttle Cable Passion XPro/Dream Yuga/Neo", mrp: 176, price: 56.3 },
      { name: "Front Brake Cable", mrp: 149, price: 47.5 },
    ],
  },
  {
    group: "Super Splendor / Glamour",
    items: [
      { name: "Clutch Cable Super/Splendor", mrp: 107, price: 34.1 },
      { name: "Throttle Cable Super Splendor/Glamour/i Smart/Passion Pro/HF DLX/Splendor Pro", mrp: 97, price: 31.0 },
      { name: "Throttle Cable Glamour FI New Model (With Cap)", mrp: 176, price: 56.3 },
      { name: "Throttle Cable Glamour FI", mrp: 140, price: 44.7 },
      { name: "Front Brake Cable Super Splendor/Glamour/Passion Pro/i Smart/Splendor Pro/Glamour Fi", mrp: 138, price: 44.0 },
      { name: "Speedometer Cable Super Splendor/Glamour", mrp: 97, price: 31.0 },
    ],
  },
  {
    group: "Super Splendor i-3S",
    items: [
      { name: "Clutch Cable Super/Splendor-i-3S", mrp: 107, price: 34.1 },
      { name: "Throttle Cable Super/Splendor i-3S", mrp: 154, price: 49.3 },
      { name: "Front Brake Combi LH Super/Splendor i-3S", mrp: 215, price: 68.6 },
      { name: "Front Brake Combi Rear Brake Super/Splendor-i3S", mrp: 325, price: 103.8 },
      { name: "Choke Cable Super/Splendor-i-3S", mrp: 108, price: 34.5 },
      { name: "Speedometer Cable Super Splendor i 3S/BS/4", mrp: 105, price: 33.4 },
    ],
  },
  {
    group: "Splendor BS-6",
    items: [
      { name: "Clutch Cable", mrp: 143, price: 45.8 },
      { name: "Throttle Cable", mrp: 176, price: 56.3 },
    ],
  },
  {
    group: "Super Splendor BS-6",
    items: [
      { name: "Clutch Cable", mrp: 160, price: 51.0 },
      { name: "Throttle Cable", mrp: 156, price: 50.0 },
    ],
  },
  {
    group: "Glamour BS-6",
    items: [
      { name: "Clutch Cable", mrp: 154, price: 49.3 },
      { name: "Throttle Cable", mrp: 152, price: 48.6 },
    ],
  },
  {
    group: "CBZ",
    items: [
      { name: "Clutch Cable", mrp: 132, price: 42.2 },
      { name: "Throttle Cable", mrp: 187, price: 59.8 },
      { name: "Front Brake Cable CBZ/Ambition", mrp: 149, price: 47.5 },
      { name: "Speedometer Cable CD 100/CBZ/Ambition/Amb-135", mrp: 99, price: 31.7 },
    ],
  },
  {
    group: "CBZ Xtreme / Hunk",
    items: [
      { name: "Clutch Cable Xtreme/Hunk/Stuner/Ignitor", mrp: 125, price: 40.1 },
      { name: "Throttle Cable X-Treme/Achiver", mrp: 138, price: 44.0 },
      { name: "Throttle Cable Hunk", mrp: 138, price: 44.0 },
      { name: "Choke Cable Xtreme/Hunk/Unicorn/Dazzler", mrp: 108, price: 34.5 },
      { name: "Speedo Cable Xtreme/Hunk/Stuner/Achiver/Ignitor", mrp: 105, price: 33.4 },
    ],
  },
  {
    group: "Ambition",
    items: [
      { name: "Clutch Cable", mrp: 141, price: 45.1 },
      { name: "Throttle Cable", mrp: 116, price: 37.0 },
      { name: "Front Brake Cable CBZ/Ambition", mrp: 149, price: 47.5 },
      { name: "Speedometer Cable CD 100/CBZ/Ambition/Amb-135", mrp: 99, price: 31.7 },
      { name: "Seat Lock", mrp: 52, price: 16.5 },
    ],
  },
  {
    group: "Karizma",
    items: [
      { name: "Clutch Cable", mrp: 132, price: 42.2 },
      { name: "Throttle Cable Open", mrp: 141, price: 45.1 },
      { name: "Throttle Cable Close", mrp: 141, price: 45.1 },
      { name: "Choke Cable Karizma/ZMR", mrp: 108, price: 34.5 },
      { name: "Speedometer Cable", mrp: 105, price: 33.4 },
    ],
  },
  {
    group: "Karizma ZMR",
    items: [
      { name: "Clutch Cable", mrp: 130, price: 41.5 },
      { name: "Throttle Cable Open", mrp: 143, price: 45.8 },
      { name: "Throttle Cable Close", mrp: 139, price: 44.4 },
      { name: "Choke Cable Karizma/ZMR", mrp: 108, price: 34.5 },
    ],
  },
  {
    group: "Achiver",
    items: [
      { name: "Clutch Cable Achiver", mrp: 141, price: 45.1 },
      { name: "Throttle Cable X-Treme/Achiver", mrp: 138, price: 44.0 },
      { name: "Front Brake Cable", mrp: 149, price: 47.5 },
      { name: "Choke Cable NXG/Achiver", mrp: 112, price: 35.9 },
      { name: "Speedo Cable Xtreme/Hunk/Stuner/Achiver/Ignitor", mrp: 105, price: 33.4 },
    ],
  },
  {
    group: "Ignitor",
    items: [
      { name: "Clutch Cable Xtreme/Hunk/Stuner/Ignitor", mrp: 125, price: 40.1 },
      { name: "Throttle Cable", mrp: 151, price: 48.2 },
      { name: "Speedo Cable Xtreme/Hunk/Stuner/Achiver/Ignitor", mrp: 105, price: 33.4 },
    ],
  },
  {
    group: "Impulse",
    items: [
      { name: "Clutch Cable", mrp: 136, price: 43.6 },
      { name: "Throttle Cable", mrp: 130, price: 41.5 },
      { name: "Choke Cable", mrp: 121, price: 38.7 },
    ],
  },
  {
    group: "Pleasure",
    items: [
      { name: "Throttle Cable", mrp: 231, price: 73.9 },
      { name: "Front Brake Cable Pleasure/Activa/Dio/Eterno", mrp: 154, price: 49.3 },
      { name: "Rear Brake Cable Pleasure/Activa Old/Dio", mrp: 209, price: 66.9 },
      { name: "Choke Cable Pleasure/Activa Old Model/Dio", mrp: 143, price: 45.8 },
      { name: "Seat Lock Cable", mrp: 66, price: 21.1 },
      { name: "Speedometer Cable Pleasure/Mestro", mrp: 116, price: 37.0 },
    ],
  },
  {
    group: "Activa 125cc / Mestro",
    items: [
      { name: "Throttle Cable Mestro/Activa 110cc/125cc/Activa i/3G", mrp: 248, price: 79.2 },
      { name: "Front Brake Combi LH Mestro/Activa 110/Avaitor 110/Activa 125/3G/i", mrp: 209, price: 66.9 },
      { name: "Front Brake Combi RH Mestro/Activa 110/Avaitor 110/Activa 125/3G/i", mrp: 215, price: 68.6 },
      { name: "Rear Brake Cable Mestro/Activa-110", mrp: 209, price: 66.9 },
      { name: "Choke Cable Mestro/Activa 110/Activa 125/3G/i/Avaitor 110", mrp: 143, price: 45.8 },
      { name: "Seat Lock Cable Mestro/Activa 110cc/125cc/3G/i/Avaitor 110cc", mrp: 66, price: 21.1 },
      { name: "Speedometer Cable Pleasure/Mestro", mrp: 116, price: 37.0 },
    ],
  },
  {
    group: "RX-100 / RXG / RX-135",
    items: [
      { name: "Clutch Cable RX-100/RXG", mrp: 97, price: 31.0 },
      { name: "Throttle Cable RX-100", mrp: 209, price: 66.9 },
      { name: "Throttle Cable RXG/RX-135", mrp: 215, price: 68.6 },
      { name: "Front Brake Cable RX-100/RXG", mrp: 99, price: 31.7 },
      { name: "Choke Cable RXG/RX-135", mrp: 72, price: 22.9 },
      { name: "Speedometer Cable RX-100/RXG", mrp: 105, price: 33.4 },
    ],
  },
  {
    group: "YBX-125cc / Crux / Crux R",
    items: [
      { name: "Clutch Cable YBX", mrp: 164, price: 52.4 },
      { name: "Clutch Cable Crux/Crux R", mrp: 164, price: 52.4 },
      { name: "Throttle Cable YBX", mrp: 127, price: 40.5 },
      { name: "Throttle Cable Crux/Crux R/Crux 2004", mrp: 127, price: 40.5 },
      { name: "Front Brake Cable YBX/Crux/Crux R", mrp: 116, price: 37.0 },
      { name: "Choke Cable YBX/Crux/Crux R/Crux 2004 Model", mrp: 105, price: 33.4 },
      { name: "Speedometer Cable YBX/Crux/Crux R", mrp: 105, price: 33.4 },
    ],
  },
  {
    group: "Crux S Model",
    items: [
      { name: "Clutch Cable", mrp: 142, price: 45.4 },
      { name: "Throttle Cable", mrp: 127, price: 40.5 },
      { name: "Front Brake Cable", mrp: 124, price: 39.8 },
      { name: "Speedometer Cable Crux S/Crux 2004 Model", mrp: 105, price: 33.4 },
    ],
  },
  {
    group: "Crux 2004 Model",
    items: [
      { name: "Clutch Cable", mrp: 127, price: 40.5 },
      { name: "Speedometer Cable Crux S/Crux 2004 Model", mrp: 107, price: 34.1 },
    ],
  },
  {
    group: "Enticer",
    items: [
      { name: "Clutch Cable", mrp: 141, price: 45.1 },
      { name: "Throttle Cable", mrp: 130, price: 41.5 },
      { name: "Front Brake Cable", mrp: 117, price: 37.3 },
      { name: "Choke Cable", mrp: 80, price: 25.7 },
      { name: "Speedometer Cable Drum", mrp: 102, price: 32.7 },
      { name: "Speedometer Cable Disk", mrp: 116, price: 37.0 },
    ],
  },
  {
    group: "Libero / Libero G-5 / Alba / YBR",
    items: [
      { name: "Clutch Cable Libero", mrp: 176, price: 56.3 },
      { name: "Clutch Cable Libero G-5/Alba/YBR-125", mrp: 164, price: 52.4 },
      { name: "Throttle Cable Libero/Libero G-5/Libero LX", mrp: 132, price: 42.2 },
      { name: "Throttle Cable Alba/YBR", mrp: 132, price: 42.2 },
      { name: "Front Brake Cable Libero/G5/Alba/YBR-125", mrp: 165, price: 52.8 },
      { name: "Choke Cable Libero/G-5/Alba/YBR", mrp: 94, price: 29.9 },
      { name: "Speedometer Cable Libero/Fazer Drum", mrp: 101, price: 32.4 },
      { name: "Speedometer Cable Libero G-5/Alba/YBR", mrp: 108, price: 34.5 },
    ],
  },
  {
    group: "Gladitor / Fazer",
    items: [
      { name: "Clutch Cable Gladitor/Fazer New/YBR 125/SS-125", mrp: 160, price: 51.0 },
      { name: "Throttle Cable Gladitor/Fazer New/YBR 125/SS-125", mrp: 138, price: 44.0 },
      { name: "Front Brake Cable Gladitor/Fazer New/YBR 125/SS-125", mrp: 171, price: 54.6 },
      { name: "Choke Cable Gladitor/Fazer", mrp: 74, price: 23.6 },
      { name: "Speedometer Cable Fazer Disk", mrp: 108, price: 34.5 },
      { name: "Speedometer Cable Gladitor Disk/SZR/SZ RR/SZX", mrp: 105, price: 33.4 },
    ],
  },
  {
    group: "Libero LX",
    items: [
      { name: "Clutch Cable", mrp: 132, price: 42.2 },
      { name: "Throttle Cable Libero/Libero G-5/Libero LX", mrp: 130, price: 41.5 },
      { name: "Front Brake Cable", mrp: 160, price: 51.0 },
      { name: "Choke Cable", mrp: 87, price: 27.8 },
      { name: "Speedometer Cable", mrp: 105, price: 33.4 },
    ],
  },
  {
    group: "FZ-16 / FZS",
    items: [
      { name: "Clutch Cable FZ-16/SZR/SZX/Fazer New/FZS/FZS Fi Version 2.0", mrp: 165, price: 52.8 },
      { name: "Clutch Cable FZ-250 CC", mrp: 182, price: 58.1 },
      { name: "Throttle Cable FZ-16/SZX/SZR/SZ-RR", mrp: 149, price: 47.5 },
      { name: "Throttle Cable FZS 250 CC", mrp: 479, price: 153.1 },
      { name: "Throttle Cable FZS 2011 Model", mrp: 176, price: 56.3 },
      { name: "Throttle Cable FZS Part I New 2012 Model", mrp: 176, price: 56.3 },
      { name: "Throttle Cable FZS Part II New 2012 Model", mrp: 171, price: 54.6 },
      { name: "Throttle Cable SZ-RR (A-Part) 2013", mrp: 194, price: 62.0 },
      { name: "Throttle Cable SZ-RR (B-Part) 2013", mrp: 176, price: 56.3 },
      { name: "Throttle Cable FZS Fi Part I Version 2.0", mrp: 176, price: 56.3 },
      { name: "Throttle Cable FZS Fi Part II Version 2.0", mrp: 165, price: 52.8 },
      { name: "Choke Cable FZ-16/FZS Old Model", mrp: 121, price: 38.7 },
      { name: "Choke Cable FZS Long", mrp: 138, price: 44.0 },
    ],
  },
  {
    group: "SZX / SZR",
    items: [
      { name: "Clutch Cable FZ-16/SZR/SZX/Fazer New/FZS/FZS Fi Version 2.0", mrp: 165, price: 52.8 },
      { name: "Throttle Cable SZR Part I", mrp: 182, price: 58.1 },
      { name: "Throttle Cable SZR Part II", mrp: 176, price: 56.3 },
      { name: "Front Brake Cable SZX/SZR/SZ RR", mrp: 163, price: 52.1 },
      { name: "Choke Cable SZX/SZR/SZ RR", mrp: 132, price: 42.2 },
      { name: "Speedometer Cable Saluto", mrp: 111, price: 35.6 },
      { name: "Speedometer Cable Gladitor Disk/SZR/SZRR", mrp: 105, price: 33.4 },
    ],
  },
  {
    group: "Yamaha R-15",
    items: [
      { name: "Clutch Cable R-15/R-15 Version 2.0", mrp: 141, price: 45.1 },
      { name: "Throttle Cable R-15", mrp: 154, price: 49.3 },
      { name: "Throttle Cable R-15 Part I Version 2.0", mrp: 193, price: 61.6 },
      { name: "Throttle Cable R-15 Part II Version 2.0", mrp: 182, price: 58.1 },
    ],
  },
  {
    group: "Ray / Ray-Z / Fascino",
    items: [
      { name: "Throttle Cable Ray Part I/Ray Z/Fascino", mrp: 281, price: 89.8 },
      { name: "Throttle Cable Ray Part II/Ray Z/Fascino", mrp: 253, price: 81.0 },
      { name: "Throttle Cable Alpha", mrp: 297, price: 95.0 },
      { name: "Front Brake Cable Ray/Ray Z/Alpha/Fascino", mrp: 165, price: 52.8 },
      { name: "Rear Brake Cable Ray/Ray Z/Alpha/Fascino", mrp: 242, price: 77.4 },
      { name: "Choke Cable Ray/Ray Z/Alpha/Fascino", mrp: 171, price: 54.6 },
      { name: "Speedometer Cable Ray/Ray Z/Alpha/Fascino", mrp: 116, price: 37.0 },
    ],
  },
  {
    group: "Fascino N/M",
    items: [
      { name: "Throttle Cable Fascino Single Wire", mrp: 242, price: 77.4 },
      { name: "Front Brake Cable Ray/Ray Z/Alpha/Fascino", mrp: 165, price: 52.8 },
      { name: "Rear Brake Cable Ray/Ray Z/Alpha/Fascino", mrp: 242, price: 77.4 },
      { name: "Choke Cable Ray/Ray Z/Alpha/Fascino", mrp: 171, price: 54.6 },
      { name: "Speedometer Cable Fascino N/M", mrp: 127, price: 40.5 },
    ],
  },
  {
    group: "Saluto",
    items: [
      { name: "Clutch Cable", mrp: 242, price: 77.4 },
      { name: "Throttle Cable", mrp: 160, price: 51.0 },
      { name: "Choke Cable", mrp: 171, price: 54.6 },
      { name: "Speedometer Cable", mrp: 127, price: 40.5 },
    ],
  },
  {
    group: "Unicorn / Dazzler",
    items: [
      { name: "Clutch Cable Unicorn/Dazzler", mrp: 141, price: 45.1 },
      { name: "Throttle Cable Unicorn/Dazzler", mrp: 138, price: 44.0 },
      { name: "Choke Cable Xtreme/Hunk/Unicorn/Dazzler", mrp: 108, price: 34.5 },
      { name: "Speedometer Cable Unicorn Old/Dream Yuga/Neo/Dazzler", mrp: 105, price: 33.4 },
      { name: "Speedometer Cable Unicorn New/Twister", mrp: 99, price: 31.7 },
    ],
  },
  {
    group: "Stuner",
    items: [
      { name: "Clutch Cable Xtreme/Hunk/Stuner/Ignitor", mrp: 125, price: 40.1 },
      { name: "Throttle Cable", mrp: 143, price: 45.8 },
      { name: "Front Brake Cable Stuner/Twister", mrp: 154, price: 49.3 },
      { name: "Choke Cable", mrp: 121, price: 38.7 },
      { name: "Speedo Cable Xtreme/Hunk/Stuner/Achiver", mrp: 105, price: 33.4 },
    ],
  },
  {
    group: "Dream Yuga / Neo",
    items: [
      { name: "Clutch Cable Dream Yuga/Neo", mrp: 132, price: 42.2 },
      { name: "Throttle Cable Passion XPro/Dream Yuga/Neo", mrp: 176, price: 56.3 },
      { name: "Front Brake Cable Dream Yuga/Shine", mrp: 149, price: 47.5 },
      { name: "Choke Cable Dream Yuga/Neo", mrp: 121, price: 38.7 },
      { name: "Speedometer Cable Unicorn Old/Dream Yuga/Neo/Dazzler", mrp: 105, price: 33.4 },
    ],
  },
  {
    group: "CB Twister",
    items: [
      { name: "Clutch Cable", mrp: 121, price: 38.7 },
      { name: "Throttle Cable", mrp: 176, price: 56.3 },
      { name: "Front Brake Cable Stuner/Twister", mrp: 154, price: 49.3 },
      { name: "Choke Cable", mrp: 99, price: 31.7 },
      { name: "Speedometer Cable Unicorn New/Twister", mrp: 105, price: 33.4 },
    ],
  },
  {
    group: "CBR-150",
    items: [
      { name: "Clutch Cable", mrp: 132, price: 42.2 },
      { name: "Throttle Cable CBR-150/Trigger", mrp: 154, price: 49.3 },
    ],
  },
  {
    group: "Trigger",
    items: [
      { name: "Clutch Cable", mrp: 154, price: 49.3 },
      { name: "Throttle Cable CBR-150/Trigger", mrp: 154, price: 49.3 },
      { name: "Choke Cable", mrp: 108, price: 34.5 },
    ],
  },
  {
    group: "Eterno",
    items: [
      { name: "Clutch Cable", mrp: 138, price: 44.0 },
      { name: "Throttle Cable N/M/Carburetor Nut", mrp: 253, price: 81.0 },
      { name: "Front Brake Cable Eterno/Activa/Dio", mrp: 154, price: 49.3 },
      { name: "Rear Brake Cable", mrp: 209, price: 66.9 },
      { name: "Choke Cable Eterno", mrp: 143, price: 45.8 },
      { name: "Gear Cable-I", mrp: 160, price: 51.0 },
      { name: "Gear Cable-II", mrp: 171, price: 54.6 },
      { name: "Speedometer Cable Eterno/Activa/Dio", mrp: 116, price: 37.0 },
      { name: "Seat Lock Eterno/Activa", mrp: 66, price: 21.1 },
    ],
  },
  {
    group: "Shine",
    items: [
      { name: "Clutch Cable Shine", mrp: 141, price: 45.1 },
      { name: "Throttle Cable", mrp: 143, price: 45.8 },
      { name: "Front Brake Cable Yuga/Shine", mrp: 149, price: 47.5 },
      { name: "Choke Cable", mrp: 99, price: 31.7 },
      { name: "Speedo Cable Xtreme/Hunk/Stuner/Achiver/Shine", mrp: 105, price: 33.4 },
    ],
  },
  {
    group: "Shine BS-6",
    items: [
      { name: "Throttle Cable", mrp: 154, price: 49.3 },
    ],
  },
  {
    group: "Activa / Dio",
    items: [
      { name: "Throttle Cable", mrp: 237, price: 75.7 },
      { name: "Front Brake Cable Eterno/Activa/Dio", mrp: 154, price: 49.3 },
      { name: "Rear Brake Cable Pleasure/Eterno/Activa Old", mrp: 209, price: 66.9 },
      { name: "Choke Cable Pleasure/Activa Old Model/Dio", mrp: 143, price: 45.8 },
      { name: "Speedometer Cable Eterno/Activa/Dio", mrp: 116, price: 37.0 },
      { name: "Seat Lock Eterno/Activa", mrp: 66, price: 21.1 },
    ],
  },
  {
    group: "Activa 110cc",
    items: [
      { name: "Throttle Cable Mestro/Activa 110cc/125cc/Activa i/3G", mrp: 248, price: 79.2 },
      { name: "Front Brake Cable Mestro/Activa 110cc", mrp: 154, price: 49.3 },
      { name: "Front Brake Combi LH Mestro/Activa 110/Avaitor 110/Activa 125/3G/i", mrp: 209, price: 66.9 },
      { name: "Front Brake Combi RH Mestro/Activa 110/Avaitor 110/Activa 125/3G/i", mrp: 215, price: 68.6 },
      { name: "Choke Cable Mestro/Activa 110/Activa 125/3G/i/Avaitor 110", mrp: 143, price: 45.8 },
      { name: "Rear Brake Cable Mestro/Activa-110", mrp: 209, price: 66.9 },
      { name: "Rear Brake Cable Small (I Part) Activa 125cc/3G/i/Avaitor-110", mrp: 138, price: 44.0 },
      { name: "Rear Brake Cable Big (I Part) Activa 125cc/3G/i/Avaitor-110", mrp: 275, price: 88.0 },
      { name: "Seat Lock Cable Mestro/Activa 110cc/125cc/3G/i/Avaitor 110cc", mrp: 72, price: 22.9 },
      { name: "Speedometer Cable Activa 110cc/125cc/3G/i/Avaitor 110cc", mrp: 113, price: 36.3 },
    ],
  },
  {
    group: "Maestro Edge",
    items: [
      { name: "Throttle Cable", mrp: 238, price: 76.0 },
      { name: "Front Brake Combi LH Mestro Edge", mrp: 231, price: 73.9 },
      { name: "Front Brake Combi RH Mestro Edge", mrp: 231, price: 73.9 },
      { name: "Choke Cable", mrp: 160, price: 51.0 },
      { name: "Rear Brake Cable", mrp: 209, price: 66.9 },
      { name: "Speedometer Cable", mrp: 116, price: 37.0 },
    ],
  },
  {
    group: "Activa 6G",
    items: [
      { name: "Throttle Cable Activa-6G (A-Part)", mrp: 294, price: 94.0 },
      { name: "Throttle Cable Activa-6G (B-Part)", mrp: 294, price: 94.0 },
      { name: "Rear Brake Cable", mrp: 275, price: 88.0 },
    ],
  },
  {
    group: "NTorq 6G",
    items: [
      { name: "Throttle Cable NTorq Band Cap (Old)", mrp: 301, price: 96.4 },
      { name: "Throttle Cable NTorq 6G", mrp: 286, price: 91.5 },
      { name: "Rear Brake Cable", mrp: 281, price: 89.8 },
    ],
  },
  {
    group: "Grazia 125cc",
    items: [
      { name: "Throttle Cable", mrp: 277, price: 88.7 },
      { name: "Rear Brake Cable", mrp: 226, price: 72.2 },
      { name: "Speedometer Cable", mrp: 116, price: 37.0 },
    ],
  },
  {
    group: "Hornet",
    items: [
      { name: "Clutch Cable", mrp: 149, price: 47.5 },
    ],
  },
  {
    group: "Avaitor 100cc",
    items: [
      { name: "Throttle Cable", mrp: 259, price: 82.7 },
      { name: "Front Brake Cable", mrp: 165, price: 52.8 },
      { name: "Choke Cable", mrp: 143, price: 45.8 },
      { name: "Rear Brake Cable", mrp: 226, price: 72.2 },
      { name: "Speedometer Cable", mrp: 116, price: 37.0 },
    ],
  },
  {
    group: "Avaitor 110cc",
    items: [
      { name: "Throttle Cable", mrp: 282, price: 90.1 },
      { name: "Front Brake Combi LH Mestro/Activa 110/Avaitor 110/Activa 125/3G/i", mrp: 209, price: 66.9 },
      { name: "Front Brake Combi RH Mestro/Activa 110/Avaitor 110/Activa 125/3G/i", mrp: 215, price: 68.6 },
      { name: "Choke Cable Mestro/Activa 110/Activa 125/3G/i/Avaitor 110", mrp: 143, price: 45.8 },
      { name: "Rear Brake Cable Small (I Part) Activa 125cc/3G/i/Avaitor-110", mrp: 138, price: 44.0 },
      { name: "Rear Brake Cable Big (I Part) Activa 125cc/3G/i/Avaitor-110", mrp: 275, price: 88.0 },
      { name: "Seat Lock Cable Mestro/Activa 110cc/125cc/3G/i/Avaitor 110cc", mrp: 66, price: 21.1 },
      { name: "Speedometer Cable Activa 110cc/125cc/3G/i/Avaitor 110cc", mrp: 113, price: 36.3 },
    ],
  },
  {
    group: "Energy / Adreno / Freedom",
    items: [
      { name: "Clutch Cable Freedom/Prima/Energy/Aderno", mrp: 127, price: 40.5 },
      { name: "Throttle Cable Freedom/Aderno", mrp: 112, price: 35.9 },
      { name: "Front Brake Cable Freedom/Prima/Energy/Aderno", mrp: 143, price: 45.8 },
      { name: "Choke Cable Freedom/Prima", mrp: 105, price: 33.4 },
      { name: "Speedometer Cable Energy/Adreno", mrp: 103, price: 33.1 },
      { name: "Speedometer Cable Freedom/Prima", mrp: 105, price: 33.4 },
    ],
  },
  {
    group: "Prima 110cc / 125cc",
    items: [
      { name: "Clutch Cable Freedom/Prima/Energy/Aderno", mrp: 127, price: 40.5 },
      { name: "Throttle Cable 110cc", mrp: 240, price: 76.7 },
      { name: "Throttle Cable 125cc", mrp: 242, price: 77.4 },
      { name: "Front Brake Cable Freedom/Prima/Energy/Aderno", mrp: 143, price: 45.8 },
    ],
  },
  {
    group: "CRD-100",
    items: [
      { name: "Clutch Cable", mrp: 121, price: 38.7 },
      { name: "Throttle Cable", mrp: 237, price: 75.7 },
    ],
  },
  {
    group: "Vespa NV / XE",
    items: [
      { name: "Clutch Cable", mrp: 105, price: 33.4 },
      { name: "Throttle Cable", mrp: 94, price: 29.9 },
      { name: "Front Brake Cable", mrp: 94, price: 29.9 },
      { name: "Front Brake Cable N/M", mrp: 94, price: 29.9 },
      { name: "Rear Brake Cable", mrp: 92, price: 29.6 },
      { name: "Choke Cable", mrp: 50, price: 15.8 },
      { name: "Gear Cable", mrp: 91, price: 29.2 },
      { name: "Speedometer Cable", mrp: 113, price: 36.3 },
      { name: "Cable Kit Set of 7", mrp: 484, price: 154.9 },
      { name: "Cable Kit Set of 8", mrp: 572, price: 183.0 },
    ],
  },
  {
    group: "Zeus / Heat / Sling Shot (Old Model)",
    items: [
      { name: "Clutch Cable", mrp: 226, price: 72.2 },
      { name: "Throttle Cable Zeus/Heat/Sling Shot/Hayate", mrp: 149, price: 47.5 },
      { name: "Front Brake Cable", mrp: 242, price: 77.4 },
      { name: "Choke Cable Sling Shot/GS-150R", mrp: 134, price: 42.9 },
      { name: "Speedometer Cable Zeus Drum/Heat Drum/Sling Shot/Hayate", mrp: 116, price: 37.0 },
      { name: "Speedometer Cable Zeus Disk/Heat Disk", mrp: 119, price: 38.0 },
    ],
  },
  {
    group: "GS-150 R",
    items: [
      { name: "Clutch Cable", mrp: 218, price: 69.7 },
      { name: "Throttle Cable Part I", mrp: 176, price: 56.3 },
      { name: "Throttle Cable Part II", mrp: 171, price: 54.6 },
      { name: "Choke Cable Sling Shot/GS-150R", mrp: 134, price: 42.9 },
    ],
  },
  {
    group: "Hayate",
    items: [
      { name: "Clutch Cable", mrp: 218, price: 69.7 },
      { name: "Throttle Cable Zeus/Heat/Sling Shot/Hayate", mrp: 149, price: 47.5 },
      { name: "Front Brake Cable", mrp: 242, price: 77.4 },
      { name: "Speedometer Cable Zeus Drum/Heat Drum/Sling Shot/Hayate", mrp: 116, price: 37.0 },
    ],
  },
  {
    group: "Gixxer",
    items: [
      { name: "Clutch Cable", mrp: 242, price: 77.4 },
      { name: "Throttle Cable", mrp: 198, price: 63.4 },
      { name: "Choke Cable", mrp: 160, price: 51.0 },
    ],
  },
  {
    group: "Access / Swiss-125",
    items: [
      { name: "Throttle Cable", mrp: 215, price: 68.6 },
      { name: "Front Brake Cable", mrp: 187, price: 59.8 },
      { name: "Rear Brake Cable", mrp: 231, price: 73.9 },
      { name: "Choke Cable", mrp: 182, price: 58.1 },
      { name: "Speedometer Cable", mrp: 121, price: 38.7 },
      { name: "Seat Lock Cable", mrp: 116, price: 37.0 },
    ],
  },
  {
    group: "Access N/M",
    items: [
      { name: "Speedometer Cable", mrp: 127, price: 40.5 },
    ],
  },
  {
    group: "Suzuki AX-100 / Max-100",
    items: [
      { name: "Clutch Cable", mrp: 102, price: 32.7 },
      { name: "Throttle Cable", mrp: 143, price: 45.8 },
      { name: "Front Brake Cable", mrp: 116, price: 37.0 },
      { name: "Choke Cable Suzuki", mrp: 72, price: 22.9 },
      { name: "Speedometer Cable Suzuki/Samurai/Shougun/Fiero/Fiero New", mrp: 101, price: 32.4 },
    ],
  },
  {
    group: "Samurai / Shogun",
    items: [
      { name: "Clutch Cable", mrp: 138, price: 44.0 },
      { name: "Throttle Cable Samurai", mrp: 164, price: 52.4 },
      { name: "Front Brake Cable", mrp: 138, price: 44.0 },
      { name: "Choke Cable Samurai", mrp: 75, price: 23.9 },
      { name: "Speedometer Cable Suzuki/Samurai/Shougun/Fiero/Fiero New", mrp: 99, price: 31.7 },
    ],
  },
  {
    group: "Victor / Victor GL",
    items: [
      { name: "Clutch Cable", mrp: 138, price: 44.0 },
      { name: "Throttle Cable", mrp: 163, price: 52.1 },
      { name: "Front Brake Cable Victor/Victor GL/Jive/Star Sports/Star City 110cc/Phoenix", mrp: 143, price: 45.8 },
      { name: "Choke Cable Victor/Victor GLX/GL", mrp: 83, price: 26.4 },
      { name: "Speedometer Cable Victor/GL/F2 Drum", mrp: 99, price: 31.7 },
    ],
  },
  {
    group: "Fiero / Fiero New Model",
    items: [
      { name: "Clutch Cable", mrp: 149, price: 47.5 },
      { name: "Clutch Cable N/M", mrp: 150, price: 47.9 },
      { name: "Throttle Cable", mrp: 132, price: 42.2 },
      { name: "Front Brake Cable", mrp: 143, price: 45.8 },
      { name: "Front Brake Cable N/M", mrp: 145, price: 46.5 },
      { name: "Choke Cable Fiero/Fiero New/F2/Apache 150cc", mrp: 127, price: 40.5 },
      { name: "Speedometer Cable Suzuki/Samurai/Shougun/Fiero/Fiero New", mrp: 99, price: 31.7 },
    ],
  },
  {
    group: "Fiero F2",
    items: [
      { name: "Clutch Cable", mrp: 156, price: 50.0 },
      { name: "Throttle Cable", mrp: 163, price: 52.1 },
      { name: "Front Brake Cable", mrp: 145, price: 46.5 },
      { name: "Choke Cable Fiero/Fiero New/F2/Apache 150cc", mrp: 127, price: 40.5 },
      { name: "Speedometer Cable Victor/GL/F2 Drum", mrp: 99, price: 31.7 },
    ],
  },
  {
    group: "Centra",
    items: [
      { name: "Clutch Cable", mrp: 149, price: 47.5 },
      { name: "Throttle Cable", mrp: 160, price: 51.0 },
      { name: "Front Brake Cable Centra/Star/DLX/Star City Old", mrp: 145, price: 46.5 },
      { name: "Speedometer Cable", mrp: 99, price: 31.7 },
    ],
  },
  {
    group: "Victor GLX",
    items: [
      { name: "Clutch Cable", mrp: 138, price: 44.0 },
      { name: "Throttle Cable", mrp: 163, price: 52.1 },
      { name: "Front Brake Cable", mrp: 143, price: 45.8 },
      { name: "Choke Cable Victor/Victor GLX/GL", mrp: 77, price: 24.6 },
      { name: "Speedometer Cable", mrp: 99, price: 31.7 },
    ],
  },
  {
    group: "Star / Star DLX / Star City / Sports",
    items: [
      { name: "Clutch Cable", mrp: 145, price: 46.5 },
      { name: "Throttle Cable Star/Star City Old Model (Single Wire)", mrp: 112, price: 35.9 },
      { name: "Throttle Cable Star Sports/Star City Alloy Wheel", mrp: 163, price: 52.1 },
      { name: "Throttle Cable Star 110 CVTi", mrp: 167, price: 53.5 },
      { name: "Throttle Cable Star City +", mrp: 138, price: 44.0 },
      { name: "Front Brake Cable Centra/Star/DLX/Star City Old", mrp: 147, price: 47.2 },
      { name: "Front Brake Cable Victor/Victor GL/Jive/Star Sports/Star City 110cc/Phoenix", mrp: 143, price: 45.8 },
      { name: "Choke Cable Star/Star City/Star 110cc/Jive", mrp: 99, price: 31.7 },
      { name: "Choke Cable Star Sports", mrp: 83, price: 26.4 },
      { name: "Speedometer Cable Star/Star City/Star DLX", mrp: 99, price: 31.7 },
      { name: "Speedometer Cable Star Sports Old Model", mrp: 105, price: 33.4 },
      { name: "Speedometer Cable Star 110 CVTi/Star Sports New Model/Jive", mrp: 121, price: 38.7 },
    ],
  },
  {
    group: "Apache 150cc",
    items: [
      { name: "Clutch Cable", mrp: 182, price: 58.1 },
      { name: "Clutch Cable N/M", mrp: 165, price: 52.8 },
      { name: "Throttle Cable", mrp: 163, price: 52.1 },
      { name: "Front Brake Cable Apache/Flame", mrp: 149, price: 47.5 },
      { name: "Choke Cable Fiero/Fiero New/F2/Apache 150cc", mrp: 121, price: 38.7 },
      { name: "Seat Lock Cable Apache", mrp: 77, price: 24.6 },
      { name: "Speedometer Cable Disk", mrp: 108, price: 34.5 },
      { name: "Speedometer Cable Drum", mrp: 108, price: 34.5 },
    ],
  },
  {
    group: "RTR 160cc / 180cc",
    items: [
      { name: "Clutch Cable", mrp: 156, price: 50.0 },
      { name: "Clutch Cable RTR-200/220", mrp: 171, price: 54.6 },
      { name: "Throttle Cable RTR Single Wire", mrp: 149, price: 47.5 },
      { name: "Throttle Cable RTR 160/180cc", mrp: 163, price: 52.1 },
      { name: "Throttle Cable RTR 160/180cc with Lower Bend", mrp: 176, price: 56.3 },
      { name: "Choke Cable", mrp: 138, price: 44.0 },
    ],
  },
  {
    group: "Flame",
    items: [
      { name: "Clutch Cable", mrp: 171, price: 54.6 },
      { name: "Throttle Cable", mrp: 176, price: 56.3 },
      { name: "Front Brake Cable Apache/Flame", mrp: 149, price: 47.5 },
      { name: "Choke Cable", mrp: 121, price: 38.7 },
    ],
  },
  {
    group: "Phoenix",
    items: [
      { name: "Clutch Cable Phoenix/Star City Plus Model", mrp: 149, price: 47.5 },
      { name: "Throttle Cable", mrp: 132, price: 42.2 },
      { name: "Choke Cable", mrp: 72, price: 22.9 },
      { name: "Front Brake Cable Victor/Victor GL/Jive/Star Sports/Star City 110cc/Phoenix", mrp: 143, price: 45.8 },
      { name: "Speedometer Cable Phoenix", mrp: 121, price: 38.7 },
    ],
  },
  {
    group: "Jive",
    items: [
      { name: "Throttle Cable", mrp: 121, price: 38.7 },
      { name: "Front Brake Cable Victor/Victor GL/Jive/Star Sports/Star City 110cc/Phoenix", mrp: 143, price: 45.8 },
      { name: "Choke Cable Star/Star City/Star 100cc/Jive", mrp: 98, price: 31.3 },
      { name: "Speedometer Cable Star 110 CVTi/Star Sports New Model/Jive", mrp: 121, price: 38.7 },
    ],
  },
  {
    group: "Scooty ES / KS",
    items: [
      { name: "Throttle Cable ES/New Look", mrp: 151, price: 48.2 },
      { name: "Throttle Cable KS", mrp: 144, price: 46.1 },
      { name: "Front Brake Cable", mrp: 121, price: 38.7 },
      { name: "Rear Brake Cable", mrp: 133, price: 42.6 },
      { name: "Choke Cable ES", mrp: 111, price: 35.6 },
      { name: "Choke Cable ES New Look", mrp: 111, price: 35.6 },
      { name: "Choke Cable KS", mrp: 111, price: 35.6 },
      { name: "Speedometer Cable", mrp: 107, price: 34.1 },
    ],
  },
  {
    group: "Scooty Pep / Plus",
    items: [
      { name: "Throttle Cable", mrp: 226, price: 72.2 },
      { name: "Throttle Cable Streak Single Wire", mrp: 182, price: 58.1 },
      { name: "Front Brake Cable Pep/Pep+/Zest 110/Streak", mrp: 160, price: 51.0 },
      { name: "Rear Brake Cable Pep/Pep+/Streak", mrp: 231, price: 73.9 },
      { name: "Seat Lock Cable", mrp: 72, price: 22.9 },
      { name: "Speedometer Cable Pep", mrp: 121, price: 38.7 },
      { name: "Speedometer Cable Pep+/Zest 110", mrp: 127, price: 40.5 },
    ],
  },
  {
    group: "TVS-50 XL / XT / Champ",
    items: [
      { name: "Throttle Cable", mrp: 75, price: 23.9 },
      { name: "Throttle Cable Power Port", mrp: 75, price: 23.9 },
      { name: "Front Brake Cable", mrp: 92, price: 29.6 },
      { name: "Rear Brake Cable", mrp: 105, price: 33.4 },
      { name: "Choke Cable 50XL/XT/Champ/Power Port", mrp: 72, price: 22.9 },
      { name: "Speedometer Cable TVS-50", mrp: 83, price: 26.4 },
      { name: "Speedometer Cable Champ", mrp: 83, price: 26.4 },
    ],
  },
  {
    group: "TVS-XL Super 70cc",
    items: [
      { name: "Throttle Cable", mrp: 116, price: 37.0 },
      { name: "Front Brake Cable", mrp: 105, price: 33.4 },
      { name: "Rear Brake Cable", mrp: 121, price: 38.7 },
      { name: "Choke Cable", mrp: 99, price: 31.7 },
      { name: "Speedometer Cable", mrp: 96, price: 30.6 },
      { name: "Speedometer Cable XL Super N/M Heavy Duty/XL-100", mrp: 99, price: 31.7 },
    ],
  },
  {
    group: "TVS-XL-100",
    items: [
      { name: "Throttle Cable", mrp: 105, price: 33.4 },
      { name: "Front Brake Cable", mrp: 160, price: 51.0 },
      { name: "Rear Brake Cable", mrp: 204, price: 65.1 },
      { name: "Choke Cable", mrp: 83, price: 26.4 },
      { name: "Speedometer Cable XL Super N/M Heavy Duty/XL-100", mrp: 99, price: 31.7 },
    ],
  },
  {
    group: "TVS-XL Super-100 BS-6",
    items: [
      { name: "Throttle Cable", mrp: 171, price: 54.6 },
      { name: "Front Brake Cable Combi Right", mrp: 215, price: 68.6 },
      { name: "Front Brake Cable Combi Left", mrp: 215, price: 68.6 },
      { name: "Rear Brake Cable", mrp: 231, price: 73.9 },
      { name: "Choke Cable", mrp: 121, price: 38.7 },
      { name: "Speedometer Cable XL Super N/M Heavy Duty/XL-100", mrp: 116, price: 37.0 },
    ],
  },
  {
    group: "Jupiter",
    items: [
      { name: "Throttle Cable", mrp: 176, price: 56.3 },
      { name: "Front Brake Cable Wego/Jupiter", mrp: 160, price: 51.0 },
      { name: "Front Brake Combi LH Jupiter", mrp: 231, price: 73.9 },
      { name: "Front Brake Combi RH Jupiter", mrp: 237, price: 75.7 },
      { name: "Rear Brake Cable Jupiter", mrp: 253, price: 81.0 },
      { name: "Choke Cable Wego/Jupiter", mrp: 171, price: 54.6 },
      { name: "Speedometer Cable Jupiter/Pep+ N/M", mrp: 127, price: 40.5 },
      { name: "Speedometer Cable Wego New Model/Jupiter", mrp: 121, price: 38.7 },
    ],
  },
  {
    group: "Wego / Jupiter",
    items: [
      { name: "Throttle Cable Wego", mrp: 253, price: 81.0 },
      { name: "Front Brake Cable Wego/Jupiter", mrp: 160, price: 51.0 },
      { name: "Choke Cable Wego/Jupiter", mrp: 171, price: 54.6 },
      { name: "Rear Brake Cable Wego/Zest 110cc", mrp: 253, price: 81.0 },
      { name: "Speedometer Cable Wego Old Model", mrp: 116, price: 37.0 },
      { name: "Speedometer Cable Wego New Model/Jupiter", mrp: 121, price: 38.7 },
    ],
  },
  {
    group: "KB-100 / RTZ",
    items: [
      { name: "Clutch Cable", mrp: 117, price: 37.3 },
      { name: "Throttle Cable", mrp: 128, price: 40.8 },
      { name: "Front Brake Cable", mrp: 99, price: 31.7 },
      { name: "Choke Cable", mrp: 53, price: 16.9 },
      { name: "Speedometer Cable", mrp: 94, price: 29.9 },
    ],
  },
  {
    group: "KB-4S / Boxer",
    items: [
      { name: "Clutch Cable KB4S/Boxer", mrp: 124, price: 39.8 },
      { name: "Throttle Cable KB4S/Boxer", mrp: 119, price: 38.0 },
      { name: "Front Brake Cable KB4S/Boxer/AT/Champion", mrp: 121, price: 38.7 },
      { name: "Choke Cable AR", mrp: 97, price: 31.0 },
      { name: "Speedometer Cable KB4S/Boxer/Champion", mrp: 99, price: 31.7 },
    ],
  },
  {
    group: "Caliber / Croma / Boxer CT",
    items: [
      { name: "Clutch Cable Boxer/AT/CT/AR/Champion/Caliber/Croma", mrp: 124, price: 39.8 },
      { name: "Throttle Cable Boxer/AT/CT/AR/Champion/Caliber", mrp: 119, price: 38.0 },
      { name: "Throttle Cable Croma", mrp: 116, price: 37.0 },
      { name: "Front Brake Cable Caliber/Croma/Boxer CT/BM 150", mrp: 143, price: 45.8 },
      { name: "Choke Cable Boxer AT/Boxer CT", mrp: 97, price: 31.0 },
      { name: "Speedo Cable Caliber/Pul-150/Pul-150 DTSi/Pul-180/Pul-180 DTSi", mrp: 105, price: 33.4 },
      { name: "Speedometer Cable Croma/Caliber-115", mrp: 99, price: 31.7 },
    ],
  },
  {
    group: "Caliber-115cc",
    items: [
      { name: "Clutch Cable", mrp: 130, price: 41.5 },
      { name: "Throttle Cable", mrp: 167, price: 53.5 },
      { name: "Front Brake Cable Caliber-115/Wind 125/Discover 125/Pul-150/Pul-180", mrp: 143, price: 45.8 },
      { name: "Choke Cable Caliber-115/CT-100/CT-100 DLX/Platina Old/Platina New", mrp: 99, price: 31.7 },
      { name: "Speedometer Cable Croma/Caliber-115", mrp: 99, price: 31.7 },
    ],
  },
  {
    group: "Wind-125cc",
    items: [
      { name: "Clutch Cable", mrp: 116, price: 37.0 },
      { name: "Throttle Cable Open", mrp: 122, price: 39.1 },
      { name: "Throttle Cable Close", mrp: 119, price: 38.0 },
      { name: "Front Brake Cable Caliber-115/Wind 125/Discover 125/Pul-150/Pul-180", mrp: 143, price: 45.8 },
      { name: "Speedometer Cable Wind Drum/Discover 125 Old Model", mrp: 99, price: 31.7 },
    ],
  },
  {
    group: "BYK",
    items: [
      { name: "Clutch Cable", mrp: 132, price: 42.2 },
      { name: "Throttle Cable", mrp: 121, price: 38.7 },
      { name: "Front Brake Cable", mrp: 154, price: 49.3 },
      { name: "Speedometer Cable", mrp: 101, price: 32.4 },
    ],
  },
  {
    group: "Boxer BM-150",
    items: [
      { name: "Clutch Cable", mrp: 143, price: 45.8 },
      { name: "Throttle Cable", mrp: 112, price: 35.9 },
      { name: "Throttle Cable BM-150 New Model", mrp: 121, price: 38.7 },
      { name: "Front Brake Cable Caliber/Croma/Boxer CT/BM 150", mrp: 145, price: 46.5 },
      { name: "Speedometer Cable", mrp: 105, price: 33.4 },
    ],
  },
  {
    group: "Platina-110 BS-4",
    items: [
      { name: "Clutch Cable", mrp: 156, price: 50.0 },
      { name: "Throttle Cable", mrp: 152, price: 48.6 },
      { name: "Front Brake Cable", mrp: 160, price: 51.0 },
      { name: "Speedometer Cable", mrp: 105, price: 33.4 },
    ],
  },
  {
    group: "Platina-100 Comfort",
    items: [
      { name: "Clutch Cable", mrp: 149, price: 47.5 },
      { name: "Throttle Cable", mrp: 143, price: 45.8 },
      { name: "Front Brake Cable", mrp: 160, price: 51.0 },
      { name: "Speedometer Cable", mrp: 105, price: 33.4 },
    ],
  },
  {
    group: "CT-100 / Platina",
    items: [
      { name: "Clutch Cable CT-100/Platina/Platina New/125 CT-100 DLX", mrp: 132, price: 42.2 },
      { name: "Clutch Cable Platina 100 ES", mrp: 149, price: 47.5 },
      { name: "Throttle Cable CT-100/Platina Old Model", mrp: 163, price: 52.1 },
      { name: "Throttle Cable CT-100 New Model 2013", mrp: 176, price: 56.3 },
      { name: "Throttle Cable CT-100 Deluxe (Steel Bend)", mrp: 176, price: 56.3 },
      { name: "Throttle Cable Platina-125cc N/M (Single Wire) Discover-100cc/150cc", mrp: 125, price: 40.1 },
      { name: "Throttle Cable Platina ES-100cc (Single Wire)", mrp: 132, price: 42.2 },
      { name: "Front Brake Cable CT-100/Platina/Platina New/CT-100 DLX", mrp: 143, price: 45.8 },
      { name: "Choke Cable Caliber-115/CT-100/CT-100 DLX/Platina Old/Platina New", mrp: 99, price: 31.7 },
      { name: "Speedometer Cable CT-100/Platina Old Model", mrp: 99, price: 31.7 },
      { name: "Speedometer Cable CT-DLX/Discover 135", mrp: 99, price: 31.7 },
      { name: "Speedometer Cable Platina N/M/Discover 100cc/150cc", mrp: 101, price: 32.4 },
    ],
  },
  {
    group: "Discover-100cc / Discover-150cc",
    items: [
      { name: "Clutch Cable Discover-100/Discover 150/Discover-150 New/Discover-100T/Discover-100M/Discover-125 ST", mrp: 138, price: 44.0 },
      { name: "Throttle Cable Discover-100/150cc/Platina 125 New Model", mrp: 125, price: 40.1 },
      { name: "Throttle Cable Discover-125 ST/Discover 150 New", mrp: 138, price: 44.0 },
      { name: "Front Brake Cable Discover-100/Discover 150", mrp: 143, price: 45.8 },
      { name: "Speedometer Cable Discover-100cc/100T/100-M/125 Screw Type/Platina-125 New Model", mrp: 101, price: 32.4 },
      { name: "Speedometer Cable-150cc", mrp: 99, price: 31.7 },
    ],
  },
  {
    group: "Discover-112 / Jadu",
    items: [
      { name: "Clutch Cable", mrp: 171, price: 54.6 },
      { name: "Throttle Cable", mrp: 165, price: 52.8 },
      { name: "Front Brake Cable", mrp: 145, price: 46.5 },
      { name: "Choke Cable", mrp: 94, price: 29.9 },
      { name: "Speedometer Cable Discover 112/Platina 125 New Model", mrp: 99, price: 31.7 },
    ],
  },
  {
    group: "Discover-125cc / Discover-135cc",
    items: [
      { name: "Clutch Cable Discover-125/Dis-135/Pul-180 DTSi/Pul-180 Digital", mrp: 138, price: 44.0 },
      { name: "Throttle Cable", mrp: 111, price: 35.6 },
      { name: "Front Brake Cable Caliber-115/Wind 125/Discover 125/Pul-150/Pul-180", mrp: 143, price: 45.8 },
      { name: "Choke Cable", mrp: 97, price: 31.0 },
      { name: "Speedometer Cable Wind Drum/Discover 125 Old Model", mrp: 99, price: 31.7 },
      { name: "Speedometer Cable CT-DLX/Discover 135", mrp: 101, price: 32.4 },
    ],
  },
  {
    group: "Discover 125 ST / Discover 100M / Discover 100T",
    items: [
      { name: "Clutch Cable Discover-100/Discover 150/Discover-150 New/Discover-100T/Discover-100M/Discover-125 ST", mrp: 138, price: 44.0 },
      { name: "Throttle Cable Discover-125 ST/Discover 150 New", mrp: 140, price: 44.7 },
      { name: "Throttle Cable Discover-100T/100M", mrp: 138, price: 44.0 },
      { name: "Speedometer Cable Discover-100cc/100T/100-M/Discover 125 Screw Type/Platina-125 New Model", mrp: 99, price: 31.7 },
    ],
  },
  {
    group: "Bajaj V-15",
    items: [
      { name: "Clutch Cable", mrp: 154, price: 49.3 },
      { name: "Throttle Cable", mrp: 156, price: 50.0 },
      { name: "Choke Cable", mrp: 116, price: 37.0 },
    ],
  },
  {
    group: "CT-100 B N/M",
    items: [
      { name: "Clutch Cable", mrp: 156, price: 50.0 },
      { name: "Throttle Cable", mrp: 145, price: 46.5 },
      { name: "Front Brake Cable", mrp: 160, price: 51.0 },
    ],
  },
  {
    group: "XCD-125cc / 135cc",
    items: [
      { name: "Clutch Cable", mrp: 141, price: 45.1 },
      { name: "Throttle Cable", mrp: 121, price: 38.7 },
      { name: "Front Brake Cable XCD-125/XCD-135", mrp: 138, price: 44.0 },
      { name: "Choke Cable", mrp: 83, price: 26.4 },
    ],
  },
  {
    group: "Pulsar-150 / Pulsar-180",
    items: [
      { name: "Clutch Cable 150/180", mrp: 127, price: 40.5 },
      { name: "Throttle Cable Pulsar-150", mrp: 111, price: 35.6 },
      { name: "Throttle Cable Pulsar-180", mrp: 111, price: 35.6 },
      { name: "Front Brake Cable Caliber-115/Wind 125/Discover 125/Pul-150/Pul-180", mrp: 143, price: 45.8 },
      { name: "Choke Cable 150/180", mrp: 99, price: 31.7 },
      { name: "Speedo Cable Caliber/Pul-150/Pul-150 DTSi/Pul-180/Pul-180 DTSi", mrp: 101, price: 32.4 },
    ],
  },
  {
    group: "Pulsar-135cc",
    items: [
      { name: "Clutch Cable Pulsar-150 DTSi/Pulsar-UG3/Pulsar-135cc", mrp: 138, price: 44.0 },
      { name: "Throttle Cable", mrp: 134, price: 42.9 },
    ],
  },
  {
    group: "Pulsar-150 DTSi / 180 DTSi / UG3",
    items: [
      { name: "Clutch Cable Pulsar-150 DTSi/Pulsar-UG3/Pulsar-135cc", mrp: 138, price: 44.0 },
      { name: "Clutch Cable Discover-125/Dis-135/Pul-180 DTSi/Pul-180 Digital", mrp: 138, price: 44.0 },
      { name: "Throttle Cable Pulsar-150 DTSi", mrp: 111, price: 35.6 },
      { name: "Throttle Cable Pulsar-180 DTSi", mrp: 111, price: 35.6 },
      { name: "Throttle Cable Pulsar UG3/UG4/180 Digital/200cc/220cc", mrp: 127, price: 40.5 },
      { name: "Choke Cable 150/180 DTSi", mrp: 105, price: 33.4 },
      { name: "Speedo Cable Caliber/Pul-150/Pul-150 DTSi/Pul-180/Pul-180 DTSi", mrp: 105, price: 33.4 },
    ],
  },
  {
    group: "Pulsar-200cc / 220cc / UG4",
    items: [
      { name: "Clutch Cable", mrp: 141, price: 45.1 },
      { name: "Clutch Cable Pulsar-200/220 Fi Model (Long Bend)", mrp: 171, price: 54.6 },
      { name: "Throttle Cable Pulsar UG3/UG4/180 Digital/200cc/220cc", mrp: 127, price: 40.5 },
    ],
  },
  {
    group: "Pulsar 200 NS",
    items: [
      { name: "Clutch Cable", mrp: 154, price: 49.3 },
      { name: "Throttle Cable", mrp: 171, price: 54.6 },
    ],
  },
  {
    group: "Avenger / Avenger 220cc",
    items: [
      { name: "Clutch Cable", mrp: 143, price: 45.8 },
      { name: "Throttle Cable", mrp: 138, price: 44.0 },
      { name: "Rear Brake Cable Avenger/Eliminator", mrp: 374, price: 119.7 },
      { name: "Choke Cable", mrp: 111, price: 35.6 },
      { name: "Speedometer Cable Avenger Old Model/Eliminator", mrp: 121, price: 38.7 },
      { name: "Speedometer Cable Avenger New 220 DTSi Screw Type", mrp: 132, price: 42.2 },
    ],
  },
  {
    group: "Eliminator",
    items: [
      { name: "Clutch Cable", mrp: 149, price: 47.5 },
      { name: "Throttle Cable Open", mrp: 134, price: 42.9 },
      { name: "Throttle Cable Close", mrp: 127, price: 40.5 },
      { name: "Rear Brake Cable Avenger/Eliminator", mrp: 374, price: 119.7 },
      { name: "Speedometer Cable Avenger Old Model/Eliminator", mrp: 121, price: 38.7 },
    ],
  },
  {
    group: "Chetak / Super",
    items: [
      { name: "Clutch Cable", mrp: 105, price: 33.4 },
      { name: "Throttle Cable", mrp: 96, price: 30.6 },
      { name: "Front Brake Cable Chetak/Super/Classic SL/Chetak 4 Stroke/Chetak New", mrp: 95, price: 30.3 },
      { name: "Rear Brake Cable Old", mrp: 81, price: 26.0 },
      { name: "Rear Brake Cable Chetak New/Classic SL/Chetak 4 Stroke/Legend/Bravo", mrp: 92, price: 29.6 },
      { name: "Choke Cable", mrp: 51, price: 16.2 },
      { name: "Gear Cable", mrp: 96, price: 30.6 },
      { name: "Speedometer Cable Chetak", mrp: 119, price: 38.0 },
      { name: "Speedometer Cable Super", mrp: 119, price: 38.0 },
      { name: "Clutch/Gear Outer Cable (With Liner)", mrp: 68, price: 21.8 },
      { name: "Cable Kit Set of 7 Chetak Super", mrp: 459, price: 146.8 },
      { name: "Cable Kit Set of 8 Chetak", mrp: 538, price: 172.1 },
      { name: "Cable Kit Set of 8 Super", mrp: 549, price: 175.6 },
    ],
  },
  {
    group: "Chetak 4 Stroke / Chetak New",
    items: [
      { name: "Clutch Cable", mrp: 96, price: 30.6 },
      { name: "Throttle Cable", mrp: 103, price: 33.1 },
      { name: "Front Brake Cable Chetak/Super/Classic SL/Chetak 4 Stroke/Chetak New", mrp: 88, price: 28.2 },
      { name: "Rear Brake Cable Chetak New/Classic SL/Chetak 4 Stroke/Legend/Bravo", mrp: 88, price: 28.2 },
      { name: "Choke Cable Chetak 4 Stroke/Classic SL/Bravo", mrp: 81, price: 26.0 },
      { name: "Gear Cable", mrp: 90, price: 28.9 },
      { name: "Speedometer Cable", mrp: 112, price: 35.9 },
      { name: "Cable Kit Set of 8", mrp: 589, price: 188.3 },
    ],
  },
  {
    group: "Classic / SL",
    items: [
      { name: "Clutch Cable", mrp: 96, price: 30.6 },
      { name: "Throttle Cable", mrp: 90, price: 28.9 },
      { name: "Front Brake Cable Chetak/Super/Classic SL/Chetak 4 Stroke/Chetak New", mrp: 88, price: 28.2 },
      { name: "Rear Brake Cable Chetak New/Classic SL/Chetak 4 Stroke/Legend/Bravo", mrp: 88, price: 28.2 },
      { name: "Choke Cable Chetak 4 Stroke/Classic SL/Bravo", mrp: 83, price: 26.4 },
      { name: "Gear Cable Classic/SL/Bravo", mrp: 95, price: 30.3 },
      { name: "Speedometer Cable Classic/SL/Legend/Bravo", mrp: 114, price: 36.6 },
      { name: "Cable Kit Set of 7", mrp: 498, price: 159.5 },
      { name: "Cable Kit Set of 8", mrp: 583, price: 186.6 },
    ],
  },
  {
    group: "Legend / Bravo",
    items: [
      { name: "Clutch Cable", mrp: 102, price: 32.7 },
      { name: "Throttle Cable", mrp: 108, price: 34.5 },
      { name: "Front Brake Cable", mrp: 88, price: 28.2 },
      { name: "Rear Brake Cable Chetak New/Classic SL/Chetak 4 Stroke/Legend/Bravo", mrp: 88, price: 28.2 },
      { name: "Choke Cable Legend", mrp: 81, price: 26.0 },
      { name: "Choke Cable Chetak 4 Stroke/Classic SL/Bravo", mrp: 81, price: 26.0 },
      { name: "Gear Cable Classic/SL/Bravo", mrp: 96, price: 30.6 },
      { name: "Gear Cable Legend", mrp: 96, price: 30.6 },
      { name: "Speedometer Cable Classic/SL/Legend/Bravo", mrp: 116, price: 37.0 },
      { name: "Cable Kit Set of 8 Legend", mrp: 606, price: 194.0 },
      { name: "Cable Kit Set of 8 Bravo", mrp: 612, price: 195.7 },
    ],
  },
  {
    group: "Sunny / Sunny Zip / Sprit",
    items: [
      { name: "Throttle Cable Sunny", mrp: 108, price: 34.5 },
      { name: "Throttle Cable Zip", mrp: 111, price: 35.6 },
      { name: "Throttle Cable Sprit", mrp: 124, price: 39.8 },
      { name: "Front Brake Cable Sunny/Zip/Sprit", mrp: 119, price: 38.0 },
      { name: "Rear Brake Cable Sunny/Zip/Sprit", mrp: 124, price: 39.8 },
      { name: "Choke Cable Sunny/Zip", mrp: 97, price: 31.0 },
      { name: "Choke Cable Sprit", mrp: 114, price: 36.6 },
      { name: "Speedometer Cable Sunny/Zip/Sprit", mrp: 108, price: 34.5 },
    ],
  },
  {
    group: "M-80 / M-80 (Major)",
    items: [
      { name: "Clutch Cable", mrp: 97, price: 31.0 },
      { name: "Throttle Cable", mrp: 63, price: 20.1 },
      { name: "Front Brake Cable M-80 Old", mrp: 97, price: 31.0 },
      { name: "Front Brake Cable Major/M-80 New", mrp: 124, price: 39.8 },
      { name: "Gear Cable", mrp: 68, price: 21.8 },
      { name: "Speedometer Cable M-80", mrp: 108, price: 34.5 },
      { name: "Speedometer Cable Major", mrp: 105, price: 33.4 },
      { name: "Cable Kit Set of 6 (Old Model)", mrp: 369, price: 117.9 },
      { name: "Cable Kit Set of 6 (New Model)", mrp: 407, price: 130.2 },
    ],
  },
  {
    group: "Gusto",
    items: [
      { name: "Throttle Cable", mrp: 261, price: 83.4 },
      { name: "Front Brake Cable", mrp: 167, price: 53.5 },
      { name: "Rear Brake Cable", mrp: 226, price: 72.2 },
      { name: "Choke Cable", mrp: 124, price: 39.8 },
      { name: "Speedometer Cable", mrp: 119, price: 38.0 },
    ],
  },
  {
    group: "Boss",
    items: [
      { name: "Clutch Cable", mrp: 145, price: 46.5 },
      { name: "Throttle Cable", mrp: 150, price: 47.9 },
      { name: "Front Brake Cable", mrp: 161, price: 51.4 },
      { name: "Choke Cable", mrp: 119, price: 38.0 },
      { name: "Speedometer Cable", mrp: 116, price: 37.0 },
    ],
  },
  {
    group: "Challenger",
    items: [
      { name: "Clutch Cable", mrp: 145, price: 46.5 },
      { name: "Throttle Cable", mrp: 322, price: 103.1 },
      { name: "Front Brake Cable", mrp: 161, price: 51.4 },
      { name: "Choke Cable", mrp: 124, price: 39.8 },
      { name: "Speedometer Cable", mrp: 119, price: 38.0 },
    ],
  },
  {
    group: "Centuro / Pantero",
    items: [
      { name: "Clutch Cable", mrp: 160, price: 51.0 },
      { name: "Throttle Cable", mrp: 143, price: 45.8 },
      { name: "Front Brake Cable", mrp: 154, price: 49.3 },
      { name: "Choke Cable", mrp: 116, price: 37.0 },
      { name: "Speedometer Cable", mrp: 108, price: 34.5 },
    ],
  },
  {
    group: "Honda DX / ZX",
    items: [
      { name: "Throttle Cable", mrp: 266, price: 85.2 },
      { name: "Front Brake Cable", mrp: 164, price: 52.4 },
      { name: "Rear Brake Cable", mrp: 231, price: 73.9 },
      { name: "Choke Cable Y2K", mrp: 160, price: 51.0 },
      { name: "Speedometer Cable", mrp: 116, price: 37.0 },
      { name: "Seat Lock", mrp: 65, price: 20.8 },
    ],
  },
  {
    group: "Nova-115cc / Nova-135cc / Duro / DZ",
    items: [
      { name: "Throttle Cable-115cc", mrp: 224, price: 71.8 },
      { name: "Throttle Cable-135cc", mrp: 312, price: 100.0 },
      { name: "Throttle Cable Duro/Rodio/Flyte/Smile/DZ", mrp: 198, price: 63.4 },
      { name: "Front Brake Cable Nova-115/Nova 135/Duro/DZ", mrp: 175, price: 56.0 },
      { name: "Rear Brake Cable Nova-115/Nova 135/Duro/Duro DZ", mrp: 226, price: 72.2 },
      { name: "Choke Cable-115cc", mrp: 164, price: 52.4 },
      { name: "Choke Cable-135cc", mrp: 164, price: 52.4 },
      { name: "Choke Cable Duro/Rodio/Flyte/DZ", mrp: 158, price: 50.7 },
      { name: "Speedometer Cable Nova-115/Nova 135/Duro/Zing 80cc/DZ", mrp: 119, price: 38.0 },
    ],
  },
  {
    group: "Marvel",
    items: [
      { name: "Throttle Cable", mrp: 289, price: 92.6 },
      { name: "Front Brake Cable", mrp: 187, price: 59.8 },
      { name: "Rear Brake Cable", mrp: 224, price: 71.8 },
      { name: "Speedometer Cable", mrp: 119, price: 38.0 },
    ],
  },
  {
    group: "Zing 80cc / Kine",
    items: [
      { name: "Throttle Cable", mrp: 184, price: 58.8 },
      { name: "Front Brake Cable", mrp: 145, price: 46.5 },
      { name: "Rear Brake Cable", mrp: 164, price: 52.4 },
      { name: "Choke Cable", mrp: 158, price: 50.7 },
      { name: "Speedometer Cable Nova-115/Nova 135/Duro/Zing 80cc/DZ", mrp: 119, price: 38.0 },
    ],
  },
  {
    group: "Luna (TFR)",
    items: [
      { name: "Throttle Cable", mrp: 68, price: 21.8 },
      { name: "Front Brake Cable", mrp: 79, price: 25.3 },
      { name: "Rear Brake Cable", mrp: 96, price: 30.6 },
      { name: "D.Comp Cable Old", mrp: 74, price: 23.6 },
      { name: "D.Comp Cable N/M (Magnum)", mrp: 74, price: 23.6 },
      { name: "Speedometer Cable", mrp: 97, price: 31.0 },
    ],
  },
  {
    group: "Luna Super 70cc",
    items: [
      { name: "Throttle Cable", mrp: 124, price: 39.8 },
      { name: "Front Brake Cable", mrp: 130, price: 41.5 },
      { name: "Rear Brake Cable", mrp: 147, price: 47.2 },
      { name: "Choke Cable", mrp: 124, price: 39.8 },
      { name: "Speedometer Cable", mrp: 116, price: 37.0 },
    ],
  },
  {
    group: "Rodio / Flyte / Smile",
    items: [
      { name: "Throttle Cable Duro/Rodio/Flyte/Smile", mrp: 198, price: 63.4 },
      { name: "Front Brake Cable", mrp: 172, price: 54.9 },
      { name: "Rear Brake Cable", mrp: 226, price: 72.2 },
      { name: "Choke Cable Duro/Rodio/Flyte/DZ", mrp: 167, price: 53.5 },
      { name: "Speedometer Cable", mrp: 119, price: 38.0 },
    ],
  },
  {
    group: "Bullet Electra / Machismo / AVL 350",
    items: [
      { name: "Clutch Cable", mrp: 154, price: 49.3 },
      { name: "Clutch Cable Electra 2007 Model 5 Speed", mrp: 143, price: 45.8 },
      { name: "Front Brake Cable", mrp: 149, price: 47.5 },
      { name: "Speedometer Cable 2014 Model 350cc", mrp: 132, price: 42.2 },
    ],
  },
  {
    group: "Thunderbird",
    items: [
      { name: "Clutch Cable", mrp: 138, price: 44.0 },
      { name: "Clutch Cable with Band", mrp: 182, price: 58.1 },
      { name: "Clutch Cable with Double Band", mrp: 160, price: 51.0 },
      { name: "Throttle Cable", mrp: 127, price: 40.5 },
      { name: "Throttle Cable with Band", mrp: 187, price: 59.8 },
      { name: "Front Brake Cable/City Bike", mrp: 132, price: 42.2 },
      { name: "D.Comp Cable", mrp: 88, price: 28.2 },
      { name: "Speedometer Cable Thunderbird/City Bike 535", mrp: 121, price: 38.7 },
    ],
  },
  {
    group: "Thunderbird Twin Spark / Classic 350cc / 500cc",
    items: [
      { name: "Clutch Cable 350cc", mrp: 140, price: 44.7 },
      { name: "Throttle Cable 350cc", mrp: 209, price: 66.9 },
    ],
  },
  {
    group: "Bullet City Bike 535cc",
    items: [
      { name: "Clutch Cable", mrp: 121, price: 38.7 },
      { name: "Throttle Cable", mrp: 88, price: 28.2 },
      { name: "Front Brake Cable/City Bike", mrp: 127, price: 40.5 },
      { name: "D.Comp Cable 350 High Handle/City Bike 535", mrp: 77, price: 24.6 },
      { name: "Speedometer Cable Thunderbird/City Bike 535", mrp: 112, price: 35.9 },
    ],
  },
  {
    group: "Rajdoot (Front Wheel)",
    items: [
      { name: "Clutch Cable Front Wheel/Deluxe/Excel-T", mrp: 97, price: 31.0 },
      { name: "Throttle Cable (Mikuni)", mrp: 88, price: 28.2 },
      { name: "Front Brake Cable", mrp: 102, price: 32.7 },
      { name: "Speedometer Cable", mrp: 102, price: 32.7 },
    ],
  },
  {
    group: "Rajdoot DLX",
    items: [
      { name: "Clutch Cable Front Wheel/Deluxe/Excel-T", mrp: 97, price: 31.0 },
      { name: "Throttle Cable (High Handle)", mrp: 90, price: 28.9 },
      { name: "Front Brake Cable With Boot+Dholki", mrp: 119, price: 38.0 },
      { name: "Speedometer Cable", mrp: 108, price: 34.5 },
    ],
  },
  {
    group: "Rajdoot Excel-T / Electronic",
    items: [
      { name: "Clutch Cable Front Wheel/Deluxe/Excel-T", mrp: 97, price: 31.0 },
      { name: "Throttle Cable", mrp: 119, price: 38.0 },
      { name: "Front Brake Cable With Boot", mrp: 108, price: 34.5 },
      { name: "Speedometer Cable", mrp: 108, price: 34.5 },
    ],
  },
];
