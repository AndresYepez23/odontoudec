/* Encuesta estudiantil OdontoUdeC
 * Fuente: formulario compartido por el usuario.
 * Categorías con opciones: selección única. Categorías abiertas: respuesta escrita.
 * No conectar envíos hasta definir y verificar el esquema seguro de respuestas en Supabase.
 */
window.ODONTOUDEC_SURVEY = Object.freeze({
  title: "Encuesta estudiantil OdontoUdeC",
  access: "authenticated",
  selection: "single",
  categories: [
    { id: "ortodoncista", title: "Mejor Ortodoncista", required: true, options: [
      "INSIGNARES ARANA INGRID MARIA",
      "LINCE VIDES FANNY ELVIRA",
      "MEDINA MARQUEZ EDUARDO",
      "PATERNINA HERNANDEZ ADOLFO",
      "RAMIREZ GARCÍA JISETH",
      "RESTREPO FRANCO ANGELICA MARIA",
      "VARGAS ESPINOSA GERMÁN"
    ]},
    { id: "odontopediatra", title: "Mejor Odontopediatra", required: true, options: [
      "ALFARO ZOLA LIZELIA MARGARITA",
      "CACERES MATTA SANDRA VIVIANA",
      "CARMONA LUIS EDUARDO",
      "GOMEZ RAMIREZ SANDRA PATRICIA",
      "GUARDO VERGARA CESAR AUGUSTO",
      "LLAMAS GARCIA JOSE IGNACIO",
      "MARTELO GOMÉZ PIEDAD",
      "PEREZ TRESPALACIOS GLORIA E.",
      "PLAZAS ROMAN JAIME ENRIQUE",
      "RAMOS MARTÍNEZ KETTY"
    ]},
    { id: "endodoncista", title: "Mejor Endodoncista", required: true, options: [
      "ALVEAR PÉREZ JAVIER IGNACIO",
      "BARCHA DEMETRIO",
      "BURGOS FUENTES TERESA",
      "COVO MORALES EDUARDO E.",
      "FLOREZ ARIZA JOSE ELIAS",
      "OSORIO CABARCAS GISELLA ISABEL",
      "RAMOS MANOTAS JACOBO",
      "VELASCO ZÚÑIGA GUSTAVO"
    ]},
    { id: "rehabilitador_oral", title: "Mejor Rehabilitador Oral", required: true, options: [
      "ABDALA ESCOBAR AIZAR",
      "ARIZA MARTINEZ STEPHANYE",
      "BERROCAL RIVAS JAIRO A.",
      "CARVAJAL CABRALES KATHERINE",
      "CASTILLO TOVAR LAURA",
      "CUADRO CAUSIL ALFONSO",
      "HERRERA DIAZ PAOLA",
      "MADRID TRONCONIS CRISTIAN",
      "MATSON ROBLES ÁLVARO ANDRÉS",
      "MENDEZ SILVA JAVIER HENRIQUE",
      "MORALES VILLA LUIS MIGUEL",
      "OSORIO FERNÁNDEZ MARIA CLAUDIA",
      "REALES GUTIERREZ YURANIS",
      "TORRES REYES LIDIS MARINA"
    ]},
    { id: "periodoncista", title: "Mejor Periodoncista", required: true, options: [
      "ACOSTA RAISH HABED EDUARDO",
      "BENEDETTI ANGULO GUIDO A.",
      "CRESCENTE PERTUZ NATALIA ANDREA",
      "DÍAZ CABALLERO ANTONIO",
      "PORRAS MENDOZA KARINA",
      "PULIDO ROZO MIRIAM M.",
      "RICO VELASCO DAVID ALBERTO",
      "ROVIRA ORTIZ CARMEN JULIA",
      "VEGA GUTIERREZ MARYURY"
    ]},
    { id: "cirujano", title: "Mejor Cirujano", required: true, options: [
      "BUELVAS ACOSTA RODRIGO",
      "CANTILLO PALLARES OSWALDO",
      "GRANOBLES SEGOVIA ANTONIO JOSÉ",
      "GUZMAN DE AVILA JAIME",
      "HARRIS RICARDO JONATHAN",
      "LEOTAU JHON FIDEL",
      "LOPEZ APARICIO ERICH BAYRON",
      "PEREZ BENAVIDES JORGE",
      "PUELLO DEL RIO EDWIN",
      "RÓDRIGUEZ VARGAS FEDERICO V."
    ]},
    { id: "semiologo", title: "Mejor Semiólogo", required: true, options: [
      "ÁLVAREZ VILLADIEGO PATRICIA",
      "CARBONEL MUÑOZ ZOILA",
      "CARMONA LORDUY MARTHA C.",
      "HIGUERA BLANCO JULIAN",
      "JIMENEZ MALAGON MARIA DEL C.",
      "OROZCO ARIZA JOSÉ DE JESÚS",
      "TETAY SALGADO SINDY",
      "TORRES OSORIO LENIN",
      "VERGARA HERNANDEZ CLARA INÉS"
    ]},
    { id: "docente", title: "Mejor Docente", required: true, type: "free_text", options: [] },
    { id: "coordinador_clinica", title: "Mejor Coordinador de Clínica", required: true, options: [
      "COVO MORALES EDUARDO E.",
      "DÍAZ CABALLERO ANTONIO",
      "MORALES VILLA LUIS MIGUEL",
      "PÉREZ TRESPALACIOS GLORIA E.",
      "BENEDETTI ANGULO GUIDO A.",
      "RAMOS MANOTAS JACOBO",
      "ÁLVAREZ VILLADIEGO PATRICIA",
      "ALVEAR PÉREZ JAVIER IGNACIO",
      "VEGA GUTIERREZ MARYURY",
      "GUZMAN DE AVILA JAIME",
      "PEREZ BENAVIDES JORGE",
      "RESTREPO FRANCO ANGELICA MARIA",
      "ABDALA ESCOBAR AIZAR",
      "JIMENEZ MALAGON MARIA DEL C."
    ]},
    { id: "docente_didactico", title: "Docente más Didáctico", required: true, type: "free_text", options: [] },
    { id: "docente_colaborador", title: "Docente más Colaborador", required: true, type: "free_text", options: [] },
    { id: "docente_inspirador", title: "Docente más Inspirador", required: true, type: "free_text", options: [] },
    { id: "docente_paciente", title: "Docente más Paciente", required: true, type: "free_text", options: [] },
    { id: "docente_calidad_humana", title: "Docente con Mayor Calidad Humana", required: true, type: "free_text", options: [] },
    { id: "docente_deja_huella", title: "Docente que Deja Huella", required: true, type: "free_text", options: [] }
  ]
});
