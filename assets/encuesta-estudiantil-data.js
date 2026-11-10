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
      "LINCE VIDES FANNY ELVIRA",
      "VARGAS ESPINOSA GERMAN",
      "INSIGNARES ARANA INGRID MARIA",
      "RESTREPO FRANCO ANGELICA MARIA",
      "PATERNINA HERNANDEZ ADOLFO"
    ]},
    { id: "odontopediatra", title: "Mejor Odontopediatra", required: true, options: [
      "PLAZAS ROMAN JAIME ENRIQUE",
      "MARTELO GOMEZ PIEDA MARY",
      "LLAMAS GARCIA JOSE IGNACIO",
      "GOMEZ RAMIREZ SANDRA PATRICIA",
      "CACERES MATTA SANDRA VIVIANA",
      "CARMONA ARANGO LUIS EDUARDO",
      "PÉREZ TRESPALACIOS GLORIA E."
    ]},
    { id: "endodoncista", title: "Mejor Endodoncista", required: true, options: [
      "VELASCO ZÚÑIGA GUSTAVO",
      "BARCHA BARRETO DEMETRIO ALFONSO",
      "BURGOS FUENTES TERESITA",
      "ALVEAR PÉREZ JAVIER IGNACIO",
      "COVO MORALES EDUARDO E.",
      "RAMOS MANOTAS JACOBO",
      "OSORIO CABARCAS GISELLA ISABEL",
      "FLOREZ ARIZA JOSE ELIAS"
    ]},
    { id: "rehabilitador_oral", title: "Mejor Rehabilitador Oral", required: true, options: [
      "CASTILLO TOVAR LAURA",
      "ABDALA ESCALA AIZAR",
      "ARIZA MARTINEZ STEPHANYE",
      "CUADRO CAUSIL ALFONSO MANUEL",
      "HERRERA DIAZ PAOLA",
      "MATSON ROBLES ALVARO ANDRES",
      "OSORIO FERNANDEZ MARIA CLAUDIA",
      "REALES GUTIERREZ YURANIS",
      "TORRES REYES LIDIS MARIA",
      "BERROCAL RIVAS JAIRO A.",
      "CARVAJAL CABRALES KATHERINE",
      "MORALES VILLA LUIS MIGUEL",
      "MENDEZ SILVA JAVIER ENRIQUE"
    ]},
    { id: "periodoncista", title: "Mejor Periodoncista", required: true, options: [
      "BENEDETTI ANGULO GUIDO A.",
      "DÍAZ CABALLERO ANTONIO",
      "PULIDO ROZO MIRIAM A.",
      "VEGA GUTIERREZ MARYURY",
      "ACOSTA RAISH HABED EDUARDO",
      "ROVIRA ORTIZ CARMEN JULIA",
      "RICO VELASCO DAVID ALBERTO",
      "CRESCENTE PERTUZ NATALIA ANDREA",
      "PORRAS MENDOZA KARINA"
    ]},
    { id: "cirujano", title: "Mejor Cirujano", required: true, options: [
      "GUZMAN DE AVILA JAIME",
      "HARRIS RICARDO JONATHAN",
      "LEOTTAU JHON FIDEL",
      "OROZO BONILLA ROBERTO CARLOS",
      "LOPEZ APARICIO ERICH BAYRON",
      "PEREZ BENAVIDES JORGE",
      "RODRÍGUEZ VARGAS FEDERICO V.",
      "TORRES OSORIO LENIN",
      "CANTILLO OSWALDO",
      "Adel Martinez"
    ]},
    { id: "semiologo", title: "Mejor Semiólogo", required: true, options: [
      "HIGUERA BLANCO JULIAN",
      "ÁLVAREZ VILLADIEGO PATRICIA",
      "CARBONELL MUÑOZ ZOILA",
      "CARMONA LORDUY MARTHA C.",
      "HARRIS RICARDO JONATHAN",
      "JIMÉNEZ MALAGÓN MARIA DEL C.",
      "TETAY SALGADO SINDY",
      "TORRES OSORIO LENIN"
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
      "ABDALA ESCALA AIZAR",
      "JIMÉNEZ MALAGÓN MARIA DEL C."
    ]},
    { id: "docente_didactico", title: "Docente más Didáctico", required: true, type: "free_text", options: [] },
    { id: "docente_colaborador", title: "Docente más Colaborador", required: true, type: "free_text", options: [] },
    { id: "docente_inspirador", title: "Docente más Inspirador", required: true, type: "free_text", options: [] },
    { id: "docente_paciente", title: "Docente más Paciente", required: true, type: "free_text", options: [] },
    { id: "docente_calidad_humana", title: "Docente con Mayor Calidad Humana", required: true, type: "free_text", options: [] },
    { id: "docente_deja_huella", title: "Docente que Deja Huella", required: true, type: "free_text", options: [] }
  ]
});
