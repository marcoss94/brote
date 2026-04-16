import XLSX from "xlsx";

const orders = [
  { numero_pedido: "001", cliente: "María García", direccion: "Av. Brasil 2580", ciudad: "Montevideo", franja_desde: "09:00", franja_hasta: "12:00", telefono: "099123456", notas: "Tocar timbre 2B" },
  { numero_pedido: "002", cliente: "Juan Rodríguez", direccion: "Bv. Artigas 1234", ciudad: "Montevideo", franja_desde: "09:00", franja_hasta: "11:00", telefono: "098654321", notas: "" },
  { numero_pedido: "003", cliente: "Ana López", direccion: "21 de Setiembre 2845", ciudad: "Montevideo", franja_desde: "10:00", franja_hasta: "13:00", telefono: "097111222", notas: "Dejar con portero" },
  { numero_pedido: "004", cliente: "Carlos Méndez", direccion: "Av. Rivera 3100", ciudad: "Montevideo", franja_desde: "08:00", franja_hasta: "10:00", telefono: "099333444", notas: "Planta grande, llevar carrito" },
  { numero_pedido: "005", cliente: "Laura Fernández", direccion: "Ellauri 540", ciudad: "Montevideo", franja_desde: "11:00", franja_hasta: "14:00", telefono: "098555666", notas: "" },
  { numero_pedido: "006", cliente: "Diego Martínez", direccion: "Av. Sarmiento 2650", ciudad: "Montevideo", franja_desde: "09:00", franja_hasta: "12:00", telefono: "097777888", notas: "Llamar antes de llegar" },
  { numero_pedido: "007", cliente: "Sofía Benítez", direccion: "Constituyente 1880", ciudad: "Montevideo", franja_desde: "14:00", franja_hasta: "17:00", telefono: "099888999", notas: "" },
  { numero_pedido: "008", cliente: "Martín Acosta", direccion: "Av. Italia 3520", ciudad: "Montevideo", franja_desde: "08:00", franja_hasta: "11:00", telefono: "098222333", notas: "Edificio sin ascensor, piso 3" },
  { numero_pedido: "009", cliente: "Valentina Suárez", direccion: "José Ellauri 350", ciudad: "Montevideo", franja_desde: "13:00", franja_hasta: "16:00", telefono: "097444555", notas: "" },
  { numero_pedido: "010", cliente: "Federico Gómez", direccion: "Av. 8 de Octubre 2845", ciudad: "Montevideo", franja_desde: "10:00", franja_hasta: "12:00", telefono: "099666777", notas: "Macetas frágiles" },
  { numero_pedido: "011", cliente: "Camila Pérez", direccion: "Canelones 1280", ciudad: "Montevideo", franja_desde: "09:00", franja_hasta: "13:00", telefono: "098111000", notas: "" },
  { numero_pedido: "012", cliente: "Sebastián Torres", direccion: "Av. Luis A. de Herrera 1420", ciudad: "Montevideo", franja_desde: "15:00", franja_hasta: "18:00", telefono: "097999888", notas: "Empresa, preguntar por recepción" },
  { numero_pedido: "013", cliente: "Lucía Ramírez", direccion: "Bv. España 2340", ciudad: "Montevideo", franja_desde: "08:00", franja_hasta: "10:30", telefono: "099444333", notas: "" },
  { numero_pedido: "014", cliente: "Andrés Olivera", direccion: "Av. Millán 3680", ciudad: "Montevideo", franja_desde: "11:00", franja_hasta: "14:00", telefono: "098777666", notas: "Dejar en garage" },
  { numero_pedido: "015", cliente: "Florencia Díaz", direccion: "Jaime Zudáñez 2830", ciudad: "Montevideo", franja_desde: "10:00", franja_hasta: "13:00", telefono: "097222111", notas: "" },
  { numero_pedido: "016", cliente: "Gabriel Viera", direccion: "Av. Garibaldi 2450", ciudad: "Montevideo", franja_desde: "14:00", franja_hasta: "16:00", telefono: "099555444", notas: "2 pedidos juntos" },
  { numero_pedido: "017", cliente: "Romina Castro", direccion: "Durazno 1560", ciudad: "Montevideo", franja_desde: "09:00", franja_hasta: "11:30", telefono: "098333222", notas: "" },
  { numero_pedido: "018", cliente: "Nicolás Herrera", direccion: "Av. Agraciada 3200", ciudad: "Montevideo", franja_desde: "13:00", franja_hasta: "15:00", telefono: "097666555", notas: "Timbre no funciona, golpear puerta" },
  { numero_pedido: "019", cliente: "Isabella Morales", direccion: "Scosería 2680", ciudad: "Montevideo", franja_desde: "10:00", franja_hasta: "12:00", telefono: "099222111", notas: "" },
  { numero_pedido: "020", cliente: "Tomás Silveira", direccion: "Av. Gral. Flores 4100", ciudad: "Montevideo", franja_desde: "15:00", franja_hasta: "18:00", telefono: "098444555", notas: "Preguntar por Tomás en local" },
];

const ws = XLSX.utils.json_to_sheet(orders);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "Pedidos");

// Column widths
ws["!cols"] = [
  { wch: 14 }, // numero_pedido
  { wch: 22 }, // cliente
  { wch: 32 }, // direccion
  { wch: 14 }, // ciudad
  { wch: 12 }, // franja_desde
  { wch: 12 }, // franja_hasta
  { wch: 14 }, // telefono
  { wch: 36 }, // notas
];

XLSX.writeFile(wb, "pedidos_ejemplo.xlsx");
console.log("✅ pedidos_ejemplo.xlsx generado — 20 pedidos en Montevideo");
