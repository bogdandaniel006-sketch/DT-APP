/**
 * Exercise library: an index of the sheets published at dtecnico.com by Diego de Miguel.
 * Nothing is copied into this project: every sheet is fetched from the original when opened.
 * To add a sheet, add a line here — the interface needs no change.
 */

export interface Exercise {
  name: string
  /** Path of the PDF, relative to its source's base URL. */
  file: string
}

export interface ExerciseGroup {
  title: string
  exercises: readonly Exercise[]
  /** Where the group comes from, in topics that gather sheets from several sites. */
  source?: ExerciseSource
}

export interface ExerciseSource {
  /** Folder of the source in this site's sheet service (/ejercicios/<id>/…); empty for the main library. */
  id: string
  title: string
  author?: string
  site: string
  /** Where the files live; a sheet's `file` is relative to it. */
  baseUrl: string
  licence?: string
}

export interface ExerciseTopic {
  title: string
  groups: readonly ExerciseGroup[]
  /** Where the topic comes from, when it is not the main library. */
  source?: ExerciseSource
}

export const EXERCISE_SOURCE: ExerciseSource = {
  id: '',
  title: 'Dibujo Técnico',
  author: 'Diego de Miguel',
  site: 'dtecnico.com',
  /** The site is only served over http. */
  baseUrl: 'http://dtecnico.com/',
}

/** The original PDF, on the source's own site. */
export const exerciseUrl = (exercise: Exercise, source = EXERCISE_SOURCE) => source.baseUrl + exercise.file

/** The same PDF handed over by this site, so the app can open it on the desk. */
export const exerciseLocalUrl = (exercise: Exercise, source = EXERCISE_SOURCE) =>
  '/ejercicios/' + (source.id ? source.id + '/' : '') + exercise.file

export const EXERCISE_TOPICS: readonly ExerciseTopic[] = [
  {
    title: 'Geometría plana',
    groups: [
      {
        title: 'Teoría',
        exercises: [
          { name: 'Proporcionalidad', file: 'doc/teoria-proporcionalidad.pdf' },
          { name: 'Triángulos y cuadriláteros', file: 'doc/teoria-triangulos-cuadrilateros.pdf' },
          { name: 'Arco capaz', file: 'doc/teoria-arco-capaz.pdf' },
          { name: 'División de la circunferencia', file: 'doc/teoria-division-circunferencia.pdf' },
          { name: 'Polígonos a partir del lado', file: 'doc/teoria-poligonos-lado.pdf' },
          { name: 'Homotecia', file: 'doc/teoria-homotecia.pdf' },
          { name: 'Curvas técnicas', file: 'doc/teoria-curvas-tecnicas.pdf' },
          { name: 'Homología y afinidad', file: 'doc/teoria-homologia-afinidad.pdf' },
          { name: 'Potencia', file: 'doc/teoria-potencia.pdf' },
          { name: 'Inversión', file: 'doc/teoria-inversion.pdf' },
          { name: 'Curvas cónicas: elipse', file: 'doc/teoria-elipse.pdf' },
          { name: 'Curvas cónicas: hipérbola', file: 'doc/teoria-hiperbola.pdf' },
          { name: 'Curvas cónicas: parábola', file: 'doc/teoria-parabola.pdf' },
        ],
      },
      {
        title: 'Conceptos básicos',
        exercises: [
          { name: 'Proporcionalidad', file: 'doc/proporcionalidad.pdf' },
          { name: 'Lugares geométricos', file: 'doc/lugares-geometricos.pdf' },
          { name: 'Arco capaz', file: 'doc/arco-capaz.pdf' },
          { name: 'Potencia', file: 'doc/potencia.pdf' },
        ],
      },
      {
        title: 'Trazado de figuras',
        exercises: [
          { name: 'Triángulos', file: 'doc/triangulos.pdf' },
          { name: 'Triángulos con arco capaz', file: 'doc/triangulos-arco-capaz.pdf' },
          { name: 'Triángulos: PAU', file: 'doc/triangulos-pau.pdf' },
          { name: 'Cuadrilateros', file: 'doc/cuadrilateros.pdf' },
          { name: 'Cuadrilateros: PAU', file: 'doc/cuadrilateros-pau.pdf' },
        ],
      },
      {
        title: 'Transformaciones',
        exercises: [
          { name: 'Traslación', file: 'doc/traslacion.pdf' },
          { name: 'Giro', file: 'doc/giro.pdf' },
          { name: 'Simetría', file: 'doc/simetria.pdf' },
          { name: 'Homotecia', file: 'doc/homotecia.pdf' },
          { name: 'Homologia', file: 'doc/homologia.pdf' },
          { name: 'Homologia: recta límite', file: 'doc/homologia-recta-limite.pdf' },
          { name: 'Homologia: problema inverso', file: 'doc/homologia-problema-inverso.pdf' },
          { name: 'Afinidad', file: 'doc/afinidad.pdf' },
          { name: 'Afinidad: problema inverso', file: 'doc/afinidad-problema-inverso.pdf' },
          { name: 'Inversión: bases', file: 'doc/inversion-fundamentales.pdf' },
          { name: 'Inversión', file: 'doc/inversion.pdf' },
          { name: 'Equivalencias', file: 'doc/equivalencias.pdf' },
        ],
      },
      {
        title: 'Tangencias',
        exercises: [
          { name: 'Tangencias', file: 'doc/tangencias.pdf' },
          { name: 'Enlaces', file: 'doc/enlaces.pdf' },
          { name: 'Tangencias de Apolonio', file: 'doc/tangencias-apolonio.pdf' },
          { name: 'Tangencias de Apolonio: PAU', file: 'doc/tangencias-apolonio-pau.pdf' },
          { name: 'Rectificación', file: 'doc/rectificacion.pdf' },
        ],
      },
      {
        title: 'Curvas cónicas',
        exercises: [
          { name: 'Curvas cónicas: elementos', file: 'doc/curvas-conicas-elementos.pdf' },
          { name: 'Curvas cónicas: tangencias', file: 'doc/curvas-conicas-tangencias.pdf' },
          { name: 'Curvas cónicas: intersecciones', file: 'doc/curvas-conicas-intersecciones.pdf' },
          { name: 'Curvas cónicas: intersección de recta con elipse por afinidad', file: 'doc/curvas-conicas-elipse-int-afinidad.pdf' },
          { name: 'Curvas cónicas: PAU', file: 'doc/curvas-conicas-pau.pdf' },
        ],
      },
      {
        title: 'Otros',
        exercises: [
          { name: 'Repaso: Tangencias de Apolonio', file: 'doc/repaso-apolonio.pdf' },
          { name: 'Repaso: Inversión', file: 'doc/repaso-inversion.pdf' },
        ],
      },
    ],
  },
  {
    title: 'Sistema Diédrico',
    groups: [
      {
        title: 'Teoría',
        exercises: [
          { name: 'Sistema diédrico', file: 'doc/teoria-diedrico.pdf' },
          { name: 'Poliedros', file: 'doc/teoria-poliedros.pdf' },
        ],
      },
      {
        title: 'Conceptos básicos',
        exercises: [
          { name: 'Definición de la recta', file: 'doc/diedrico-definicion-recta.pdf' },
          { name: 'Trazas de la recta', file: 'doc/diedrico-trazas-recta.pdf' },
          { name: 'Rectas "a ojo"', file: 'doc/diedrico-rectas-a-ojo.pdf' },
          { name: 'Trazas del plano', file: 'doc/diedrico-trazas-plano.pdf' },
          { name: 'Planos "a ojo"', file: 'doc/diedrico-planos-a-ojo.pdf' },
          { name: 'Pertenencia de punto a plano', file: 'doc/diedrico-pertenencia-punto-plano.pdf' },
          { name: 'Paralelismo', file: 'doc/diedrico-paralelismo.pdf' },
          { name: 'Perpendicularidad', file: 'doc/diedrico-perpendicularidad.pdf' },
          { name: 'Intersección plano—plano', file: 'doc/diedrico-interseccion-plano-plano.pdf' },
          { name: 'Intersección recta—plano', file: 'doc/diedrico-interseccion-recta-plano.pdf' },
          { name: 'Distancia', file: 'doc/diedrico-distancia.pdf' },
          { name: 'Bases (resumen)', file: 'doc/diedrico-bases.pdf' },
        ],
      },
      {
        title: 'Operaciones',
        exercises: [
          { name: 'Abatimiento', file: 'doc/diedrico-abatimiento.pdf' },
          { name: 'Giro', file: 'doc/diedrico-giro.pdf' },
          { name: 'Cambio de plano', file: 'doc/diedrico-cambio-plano.pdf' },
          { name: 'Tercera proyección', file: 'doc/diedrico-3a-proyeccion.pdf' },
          { name: 'Tercera proyección: PAU', file: 'doc/diedrico-3a-proyeccion-pau.pdf' },
        ],
      },
      {
        title: 'Sólidos',
        exercises: [
          { name: 'Tetraedro', file: 'doc/diedrico-tetraedro.pdf' },
          { name: 'Hexaedro', file: 'doc/diedrico-hexaedro-v003.pdf' },
          { name: 'Octaedro', file: 'doc/diedrico-octaedro.pdf' },
          { name: 'Sección de sólidos', file: 'doc/diedrico-seccion.pdf' },
          { name: 'Sección de sólidos de revolución', file: 'doc/diedrico-seccion-solidos-revolucion.pdf' },
          { name: 'Intersecciones', file: 'doc/diedrico-interseccion.pdf' },
        ],
      },
    ],
  },
  {
    title: 'Sistema Axonométrico',
    groups: [
      {
        title: 'Conceptos básicos',
        exercises: [
          { name: 'Bases', file: 'doc/axonometrico-bases.pdf' },
          { name: 'Definición del plano', file: 'doc/axonometrico-definicion-plano.pdf' },
          { name: 'Graduación de ejes', file: 'doc/axonometrico-graduacion.pdf' },
        ],
      },
      {
        title: 'Operaciones',
        exercises: [
          { name: 'Verdadera magnitud', file: 'doc/axonometrico-verdadera-magnitud.pdf' },
          { name: 'Abatimiento', file: 'doc/axonometrico-abatimiento.pdf' },
        ],
      },
      {
        title: 'Sólidos',
        exercises: [
          { name: 'Secciones e intersecciones', file: 'doc/axonometrico-seccion.pdf' },
          { name: 'Sólidos', file: 'doc/axonometrico-solidos.pdf' },
        ],
      },
    ],
  },
  {
    title: 'Perspectiva cónica',
    groups: [
      {
        title: 'Teoría',
        exercises: [
          { name: 'Perspectiva cónica', file: 'doc/teoria-pconica.pdf' },
        ],
      },
      {
        title: 'Conceptos básicos',
        exercises: [
          { name: 'Rectas', file: 'doc/pconica-rectas.pdf' },
          { name: 'Planos', file: 'doc/pconica-planos.pdf' },
          { name: 'Pertenencia', file: 'doc/pconica-pertenencia.pdf' },
          { name: 'Paralelismo', file: 'doc/pconica-paralelismo.pdf' },
          { name: 'Puntos métricos', file: 'doc/pconica-puntos-metricos.pdf' },
        ],
      },
      {
        title: 'Operaciones',
        exercises: [
          { name: 'Representación', file: 'doc/pconica-representacion.pdf' },
        ],
      },
    ],
  },
  {
    title: 'Planos acotados',
    groups: [
      {
        title: 'Cubiertas',
        exercises: [
          { name: 'Cubiertas', file: 'doc/planos-acotados-cubiertas.pdf' },
        ],
      },
    ],
  },
  {
    title: 'Normalización',
    groups: [
      {
        title: 'Teoría',
        exercises: [
          { name: 'Normalización', file: 'doc/teoria-normalizacion.pdf' },
        ],
      },
      {
        title: 'Acotación',
        exercises: [
          { name: 'Acotación', file: 'doc/acotacion.pdf' },
          { name: 'Acotación: Corte al cuarto', file: 'doc/acotacion-corte-al-cuarto.pdf' },
          { name: 'Acotación: PAU', file: 'doc/acotacion-pau.pdf' },
        ],
      },
      {
        title: 'Sección normalizada',
        exercises: [
          { name: 'Sección normalizada', file: 'doc/normalizacion-seccion.pdf' },
        ],
      },
    ],
  },
  {
    title: 'Pruebas de acceso · Madrid',
    groups: [
      {
        title: '2001—2002',
        exercises: [
          { name: 'Modelo', file: 'pau/2001-2002-mod.pdf' },
          { name: 'Ordinaria', file: 'pau/2001-2002-ord.pdf' },
          { name: 'Extraordinaria', file: 'pau/2001-2002-ext.pdf' },
        ],
      },
      {
        title: '2002—2003',
        exercises: [
          { name: 'Ordinaria', file: 'pau/2002-2003-ord.pdf' },
          { name: 'Ordinaria (Solución)', file: 'pau/2002-2003-ord-sol.pdf' },
          { name: 'Extraordinaria', file: 'pau/2002-2003-ext.pdf' },
          { name: 'Extraordinaria (Solución)', file: 'pau/2002-2003-ext-sol.pdf' },
        ],
      },
      {
        title: '2003—2004',
        exercises: [
          { name: 'Ordinaria', file: 'pau/2003-2004-ord.pdf' },
          { name: 'Modelo', file: 'pau/2003-2004-mod.pdf' },
          { name: 'Ordinaria (Solución)', file: 'pau/2003-2004-ord-sol.pdf' },
          { name: 'Extraordinaria', file: 'pau/2003-2004-ext.pdf' },
          { name: 'Extraordinaria (Solución)', file: 'pau/2003-2004-ext-sol.pdf' },
        ],
      },
      {
        title: '2004—2005',
        exercises: [
          { name: 'Ordinaria', file: 'pau/2004-2005-ord.pdf' },
          { name: 'Ordinaria (Solución)', file: 'pau/2004-2005-ord-sol.pdf' },
          { name: 'Extraordinaria', file: 'pau/2004-2005-ext.pdf' },
          { name: 'Extraordinaria (Solución)', file: 'pau/2004-2005-ext-sol.pdf' },
        ],
      },
      {
        title: '2005—2006',
        exercises: [
          { name: 'Modelo', file: 'pau/2005-2006-mod.pdf' },
          { name: 'Ordinaria', file: 'pau/2005-2006-ord.pdf' },
          { name: 'Ordinaria (Solución)', file: 'pau/2005-2006-ord-sol.pdf' },
          { name: 'Extraordinaria', file: 'pau/2005-2006-ext.pdf' },
          { name: 'Extraordinaria (Solución)', file: 'pau/2005-2006-ext-sol.pdf' },
        ],
      },
      {
        title: '2006—2007',
        exercises: [
          { name: 'Modelo', file: 'pau/2006-2007-mod.pdf' },
          { name: 'Ordinaria', file: 'pau/2006-2007-ord.pdf' },
          { name: 'Ordinaria (Solución)', file: 'pau/2006-2007-ord-sol.pdf' },
          { name: 'Extraordinaria', file: 'pau/2006-2007-ext.pdf' },
          { name: 'Extraordinaria (Solución)', file: 'pau/2006-2007-ext-sol.pdf' },
        ],
      },
      {
        title: '2007—2008',
        exercises: [
          { name: 'Ordinaria', file: 'pau/2007-2008-ord.pdf' },
          { name: 'Ordinaria (Solución)', file: 'pau/2007-2008-ord-sol.pdf' },
          { name: 'Extraordinaria', file: 'pau/2007-2008-ext.pdf' },
          { name: 'Extraordinaria (Solución)', file: 'pau/2007-2008-ext-sol.pdf' },
        ],
      },
      {
        title: '2008—2009',
        exercises: [
          { name: 'Modelo', file: 'pau/2008-2009-mod.pdf' },
          { name: 'Ordinaria', file: 'pau/2008-2009-ord.pdf' },
          { name: 'Extraordinaria', file: 'pau/2008-2009-ext.pdf' },
        ],
      },
      {
        title: '2009—2010',
        exercises: [
          { name: 'Modelo', file: 'pau/2009-2010-mod.pdf' },
          { name: 'Ordinaria', file: 'pau/2009-2010-ord.pdf' },
          { name: 'Extraordinaria', file: 'pau/2009-2010-ext.pdf' },
        ],
      },
      {
        title: '2010—2011',
        exercises: [
          { name: 'Modelo', file: 'pau/2010-2011-mod.pdf' },
          { name: 'Ordinaria', file: 'pau/2010-2011-ord.pdf' },
          { name: 'Extraordinaria', file: 'pau/2010-2011-ext.pdf' },
        ],
      },
      {
        title: '2011—2012',
        exercises: [
          { name: 'Ordinaria', file: 'pau/2011-2012-ord.pdf' },
          { name: 'Extraordinaria', file: 'pau/2011-2012-ext.pdf' },
        ],
      },
      {
        title: '2012—2013',
        exercises: [
          { name: 'Modelo (01)', file: 'pau/2012-2013-mod-01.pdf' },
          { name: 'Modelo (02)', file: 'pau/2012-2013-mod-02.pdf' },
          { name: 'Ordinaria (Coincidentes)', file: 'pau/2012-2013-ord-cdt.pdf' },
        ],
      },
      {
        title: '2013—2014',
        exercises: [
          { name: 'Modelo', file: 'pau/2013-2014-mod.pdf' },
          { name: 'Ordinaria', file: 'pau/2013-2014-ord.pdf' },
          { name: 'Extraordinaria', file: 'pau/2013-2014-ext.pdf' },
        ],
      },
      {
        title: '2014—2015',
        exercises: [
          { name: 'Modelo', file: 'pau/2014-2015-mod.pdf' },
          { name: 'Ordinaria', file: 'pau/2014-2015-ord.pdf' },
          { name: 'Extraordinaria', file: 'pau/2014-2015-ext.pdf' },
        ],
      },
      {
        title: '2015—2016',
        exercises: [
          { name: 'Modelo', file: 'pau/2015-2016-mod.pdf' },
          { name: 'Ordinaria', file: 'pau/2015-2016-ord.pdf' },
          { name: 'Extraordinaria', file: 'pau/2015-2016-ext.pdf' },
        ],
      },
      {
        title: '2016—2017',
        exercises: [
          { name: 'Modelo', file: 'pau/2016-2017-mod.pdf' },
          { name: 'Ordinaria', file: 'pau/2016-2017-ord.pdf' },
          { name: 'Extraordinaria', file: 'pau/2016-2017-ext.pdf' },
        ],
      },
      {
        title: '2017—2018',
        exercises: [
          { name: 'Modelo', file: 'pau/2017-2018-mod.pdf' },
          { name: 'Ordinaria', file: 'pau/2017-2018-ord.pdf' },
          { name: 'Ordinaria (Coincidentes)', file: 'pau/2017-2018-ord-cdt.pdf' },
          { name: 'Extraordinaria', file: 'pau/2017-2018-ext.pdf' },
        ],
      },
      {
        title: '2018—2019',
        exercises: [
          { name: 'Modelo', file: 'pau/2018-2019-mod.pdf' },
          { name: 'Ordinaria', file: 'pau/2018-2019-ord.pdf' },
          { name: 'Extraordinaria', file: 'pau/2018-2019-ext.pdf' },
        ],
      },
      {
        title: '2019—2020',
        exercises: [
          { name: 'Modelo', file: 'pau/2019-2020-mod.pdf' },
          { name: 'Ordinaria', file: 'pau/2019-2020-ord.pdf' },
          { name: 'Extraordinaria', file: 'pau/2019-2020-ext.pdf' },
        ],
      },
      {
        title: '2020—2021',
        exercises: [
          { name: 'Modelo', file: 'pau/2020-2021-mod.pdf' },
          { name: 'Ordinaria', file: 'pau/2020-2021-ord.pdf' },
          { name: 'Extraordinaria', file: 'pau/2020-2021-ext.pdf' },
        ],
      },
      {
        title: '2021—2022',
        exercises: [
          { name: 'Modelo', file: 'pau/2021-2022-mod.pdf' },
          { name: 'Ordinaria', file: 'pau/2021-2022-ord.pdf' },
          { name: 'Ordinaria (Coincidentes)', file: 'pau/2021-2022-ord-cdt.pdf' },
          { name: 'Extraordinaria', file: 'pau/2021-2022-ext.pdf' },
        ],
      },
      {
        title: '2022—2023',
        exercises: [
          { name: 'Modelo', file: 'pau/2022-2023-mod.pdf' },
          { name: 'Ordinaria', file: 'pau/2022-2023-ord.pdf' },
          { name: 'Extraordinaria', file: 'pau/2022-2023-ext.pdf' },
        ],
      },
      {
        title: '2023—2024',
        exercises: [
          { name: 'Modelo', file: 'pau/2023-2024-mod.pdf' },
          { name: 'Ordinaria', file: 'pau/2023-2024-ord.pdf' },
          { name: 'Extraordinaria', file: 'pau/2023-2024-ext.pdf' },
          { name: 'Extraordinaria (Coincidentes)', file: 'pau/2023-2024-ext-cdt.pdf' },
        ],
      },
    ],
  },
]

/*
 * Other sites. Their sheets are kept apart from the main library, each under its own credit.
 * Every entry was read from the site's own pages; nothing here is guessed.
 */

const LAS_LAMINAS: ExerciseSource = {
  id: 'laslaminas',
  title: 'laslaminas.es',
  site: 'laslaminas.es',
  baseUrl: 'https://www.laslaminas.es/',
  licence: 'CC BY-NC-ND 3.0',
}

const IBAIGUREN: ExerciseSource = {
  id: 'ibiguridt',
  title: 'Dibujo Técnico · ibiguridt',
  site: 'ibiguridt.wordpress.com',
  baseUrl: 'https://ibiguridt.wordpress.com/wp-content/uploads/',
}

const DIBUJOTECNICO_COM: ExerciseSource = {
  id: 'dibujotecnico',
  title: 'Dibujotecnico.com',
  site: 'dibujotecnico.com',
  baseUrl: 'https://www.dibujotecnico.com/Ejercicios/',
  licence: 'CC BY-NC-ND 3.0',
}

const EDUCACION_PLASTICA: ExerciseSource = {
  id: 'educacionplastica',
  title: 'Educación Plástica y Visual',
  site: 'educacionplastica.net',
  baseUrl: 'https://www.educacionplastica.net/pdfs/',
  licence: 'CC BY-NC-SA 3.0',
}

/** Topics that are one site's own course or collection. */
const SITE_TOPICS: readonly ExerciseTopic[] = [
  {
    title: 'Dibujo Técnico I',
    source: LAS_LAMINAS,
    groups: [
      {
        title: 'Escalas gráficas',
        exercises: [{ name: 'Escalas gráficas', file: 'descargas/proporcionalidad/escalas.pdf' }],
      },
      {
        title: 'Trazados geométricos básicos',
        exercises: [
          { name: 'Trazados geométricos básicos (apuntes)', file: 'cursos/primero_bat/primer_trimestre/trazados_geometricos_teo_primero_bat.pdf' },
          { name: 'Láminas con ejercicios', file: 'cursos/primero_bat/primer_trimestre/laminas_trazados_geo_basicos_primero_bat.pdf' },
        ],
      },
      {
        title: 'Normalización',
        exercises: [
          { name: 'Introducción a la representación normalizada', file: 'descargas/normalizacion/normalizacion_vistas.pdf' },
          { name: 'Rotulación y líneas normalizadas', file: 'descargas/normalizacion/rotu_lineas_normalizadas.pdf' },
        ],
      },
      {
        title: 'Transformaciones geométricas',
        exercises: [
          { name: 'Proporcionalidad / relaciones geométricas', file: 'cursos/primero_bat/primer_trimestre/proporcionalidad_relaciones.pdf' },
          { name: 'Transformaciones geométricas', file: 'cursos/primero_bat/primer_trimestre/transformaciones_intro_iso.pdf' },
          { name: 'Láminas: proporcionalidad, isometrías y escalas', file: 'cursos/primero_bat/primer_trimestre/laminas_relaciones_prop_transf_esc_primero_bat.pdf' },
        ],
      },
      {
        title: 'Polígonos',
        exercises: [
          { name: 'Triángulos y cuadriláteros', file: 'cursos/primero_bat/primer_trimestre/triangulos_y_cuadrilateros_primero_bat.pdf' },
          { name: 'Polígonos regulares', file: 'cursos/primero_bat/primer_trimestre/poligonos_regulares_primero_bat.pdf' },
          { name: 'Láminas de polígonos', file: 'cursos/primero_bat/primer_trimestre/laminas_poligonos_primero_bat.pdf' },
        ],
      },
      {
        title: 'Tangencias básicas',
        exercises: [
          { name: 'Tangencias básicas', file: 'descargas/tangencias/tangencias_basicas.pdf' },
          { name: 'Láminas de tangencias básicas', file: 'descargas/tangencias/laminas_tg_basicas.pdf' },
          { name: 'Láminas de piezas con aplicaciones de tangencias básicas', file: 'descargas/tangencias/laminas_piezas_tg_basicas.pdf' },
        ],
      },
      {
        title: 'Curvas técnicas',
        exercises: [
          { name: 'Construcciones de óvalos y ovoides', file: 'cursos/primero_bat/primer_trimestre/ovalos_ovoides.pdf' },
          { name: 'Láminas de óvalos y ovoides', file: 'cursos/primero_bat/primer_trimestre/ovalos_ovoides_laminas.pdf' },
        ],
      },
      {
        title: 'Curvas cónicas',
        exercises: [
          { name: 'La elipse', file: 'descargas/cuvas_conicas/elipse.pdf' },
          { name: 'La parábola', file: 'descargas/cuvas_conicas/parabola.pdf' },
          { name: 'La hipérbola', file: 'descargas/cuvas_conicas/hiperbola.pdf' },
          { name: 'Láminas de cónicas', file: 'descargas/cuvas_conicas/curvas_conicas_laminas.pdf' },
        ],
      },
      {
        title: 'Diédrico: punto, recta y plano',
        exercises: [
          { name: 'Apuntes de punto, recta y plano', file: 'cursos/primero_bat/segundo_trimestre/pto_recta_plano_apuntes.pdf' },
          { name: 'Láminas sobre punto, recta y plano', file: 'cursos/primero_bat/segundo_trimestre/pto_recta_plano_laminas.pdf' },
        ],
      },
      {
        title: 'Diédrico: intersecciones',
        exercises: [
          { name: 'Intersecciones', file: 'cursos/primero_bat/segundo_trimestre/sdo_intersecciones_apuntes.pdf' },
          { name: 'Láminas de intersecciones', file: 'cursos/primero_bat/segundo_trimestre/sdo_intersecciones_laminas.pdf' },
        ],
      },
      {
        title: 'Diédrico: abatimientos',
        exercises: [
          { name: 'Abatimientos', file: 'cursos/primero_bat/segundo_trimestre/abatimientos_apuntes.pdf' },
          { name: 'Láminas sobre abatimientos', file: 'descargas/diedrico/abatimientos_laminas.pdf' },
        ],
      },
      {
        title: 'Diédrico: secciones planas',
        exercises: [
          { name: 'Apuntes sobre secciones planas', file: 'cursos/primero_bat/tercer_trimestre/secciones_planas_apuntes.pdf' },
          { name: 'Láminas de secciones', file: 'descargas/diedrico/secciones_planas_laminas.pdf' },
        ],
      },
      {
        title: 'Perspectiva axonométrica ortogonal',
        exercises: [
          { name: 'Apuntes de perspectivas axonométricas ortogonales', file: 'descargas/axonometricas/axonometrica_ortogonal.pdf' },
          { name: 'Láminas sobre perspectivas axonométricas', file: 'descargas/axonometricas/axo_pto_recta_plano_laminas.pdf' },
        ],
      },
    ],
  },
  {
    title: 'Dibujo Técnico II',
    source: LAS_LAMINAS,
    groups: [
      {
        title: 'Escalas',
        exercises: [
          { name: 'Escalas', file: 'descargas/proporcionalidad/escalas.pdf' },
          { name: 'Lámina de escalas', file: 'descargas/proporcionalidad/lamina_escalas.pdf' },
        ],
      },
      {
        title: 'Normalización',
        exercises: [
          { name: 'Introducción a la representación normalizada', file: 'descargas/normalizacion/normalizacion_vistas.pdf' },
          { name: 'Rotulación y líneas normalizadas', file: 'descargas/normalizacion/rotu_lineas_normalizadas.pdf' },
          { name: 'PAU Normalización', file: 'cursos/segundo_bat/primer_trimestre/normalizacion_pau.pdf' },
          { name: 'PAU Normalización: soluciones', file: 'cursos/segundo_bat/primer_trimestre/normalizacion_pau_solu.pdf' },
        ],
      },
      {
        title: 'Transformaciones geométricas',
        exercises: [
          { name: 'PAU geometría plana', file: 'cursos/segundo_bat/primer_trimestre/geo_plana_pau.pdf' },
          { name: 'PAU geometría plana: soluciones', file: 'cursos/segundo_bat/primer_trimestre/geo_plana_pau_solu.pdf' },
          { name: 'Afinidad', file: 'descargas/transformaciones_geometricas/afinidad.pdf' },
          { name: 'Láminas de afinidad', file: 'descargas/transformaciones_geometricas/laminas_afinidad.pdf' },
          { name: 'Láminas de afinidad: soluciones', file: 'descargas/transformaciones_geometricas/laminas_afinidad_solu.pdf' },
          { name: 'Homología', file: 'descargas/transformaciones_geometricas/homologia.pdf' },
          { name: 'Láminas de homología', file: 'descargas/transformaciones_geometricas/laminas_homologia.pdf' },
          { name: 'Láminas de homología: soluciones', file: 'descargas/transformaciones_geometricas/laminas_homologia_solu.pdf' },
          { name: 'PAU de homología y afinidad', file: 'cursos/segundo_bat/primer_trimestre/homologia_afinidad_pau.pdf' },
          { name: 'PAU de homología y afinidad: soluciones', file: 'cursos/segundo_bat/primer_trimestre/homologia_afinidad_pau_solu.pdf' },
        ],
      },
      {
        title: 'Tangencias',
        exercises: [
          { name: 'PAU Tangencias', file: 'cursos/segundo_bat/primer_trimestre/tangencias_pau.pdf' },
          { name: 'PAU Tangencias: soluciones', file: 'cursos/segundo_bat/primer_trimestre/tangencias_pau_solu.pdf' },
        ],
      },
      {
        title: 'Curvas cónicas',
        exercises: [
          { name: 'La elipse', file: 'descargas/cuvas_conicas/elipse.pdf' },
          { name: 'La parábola', file: 'descargas/cuvas_conicas/parabola.pdf' },
          { name: 'La hipérbola', file: 'descargas/cuvas_conicas/hiperbola.pdf' },
          { name: 'Láminas de curvas cónicas', file: 'descargas/cuvas_conicas/curvas_conicas_laminas.pdf' },
          { name: 'Láminas de curvas cónicas: soluciones', file: 'descargas/cuvas_conicas/curvas_conicas_laminas_solu.pdf' },
          { name: 'PAU Curvas técnicas y curvas cónicas', file: 'cursos/segundo_bat/segundo_trimestre/curvas_tec_con_pau.pdf' },
          { name: 'PAU Curvas técnicas y curvas cónicas: soluciones', file: 'cursos/segundo_bat/segundo_trimestre/curvas_tec_con_pau_solu.pdf' },
        ],
      },
      {
        title: 'Sistema diédrico',
        exercises: [
          { name: 'PAU Sistema diédrico', file: 'cursos/segundo_bat/segundo_trimestre/sdo_pau.pdf' },
          { name: 'PAU Sistema diédrico: soluciones', file: 'cursos/segundo_bat/segundo_trimestre/sdo_pau_solu.pdf' },
        ],
      },
      {
        title: 'Axonométricas',
        exercises: [
          { name: 'PAU de axonométricas', file: 'cursos/segundo_bat/tercer_trimestre/axonometricas_pau.pdf' },
          { name: 'PAU de axonométricas: soluciones', file: 'cursos/segundo_bat/tercer_trimestre/axonometricas_pau_solu.pdf' },
        ],
      },
    ],
  },
  {
    title: 'Láminas de dibujo industrial',
    source: IBAIGUREN,
    groups: [
      {
        title: 'Láminas',
        exercises: [
          { name: 'Ejercicio 01: rayados', file: '2016/09/01-propuesta-de-rayados.pdf' },
          { name: 'Ejercicio 01: solución', file: '2016/10/rayados-soluccic3b3n.pdf' },
          { name: 'Lámina 01', file: '2016/10/lc3a1mina-1.pdf' },
          { name: 'Lámina 02', file: '2016/10/lc3a1mina-2.pdf' },
          { name: 'Lámina 03', file: '2016/10/lc3a1mina-3.pdf' },
          { name: 'Lámina 04', file: '2016/10/lc3a1mina-41.pdf' },
          { name: 'Lámina 05', file: '2016/10/lc3a1mina-5.pdf' },
          { name: 'Lámina 06', file: '2016/10/lc3a1mina-6.pdf' },
          { name: 'Lámina 07', file: '2016/10/lc3a1mina-7.pdf' },
          { name: 'Lámina 08', file: '2016/11/lamina-8.pdf' },
          { name: 'Lámina 09', file: '2016/11/lamina-91.pdf' },
          { name: 'Lámina 10', file: '2017/01/lc3a1mina-10.pdf' },
          { name: 'Lámina 11', file: '2017/01/lc3a1mina-11.pdf' },
          { name: 'Lámina 12', file: '2017/01/lc3a1mina-121.pdf' },
          { name: 'Lámina 13', file: '2017/01/lc3a1mina-13.pdf' },
          { name: 'Lámina 14', file: '2017/02/lc3a1mina-14.pdf' },
          { name: 'Lámina 15', file: '2017/02/lc3a1mina-15.pdf' },
          { name: 'Lámina 16', file: '2017/02/lc3a1mina-16.pdf' },
          { name: 'Lámina 17', file: '2017/02/lc3a1mina-17.pdf' },
          { name: 'Lámina 18', file: '2017/03/lc3a1mina-18.pdf' },
          { name: 'Lámina 19', file: '2017/03/lc3a1mina-19.pdf' },
          { name: 'Lámina 20', file: '2017/03/lc3a1mina-20.pdf' },
          { name: 'Lámina 22', file: '2017/04/lc3a1mina-22.pdf' },
          { name: 'Lámina 23', file: '2017/05/lc3a1mina-23.pdf' },
        ],
      },
      {
        title: 'Acotación y perspectivas',
        exercises: [
          { name: 'Ejercicio de acotación', file: '2017/03/lc3a1mina-acotacic3b3n-1.pdf' },
          { name: 'Ejercicios de perspectivas: caballera', file: '2017/01/lc3a1mina-13-perspectiva-caballera.pdf' },
          { name: 'Ejercicios de perspectivas: isométrico', file: '2017/01/lc3a1mina-14-perspectiva-isomc3a9trico.pdf' },
        ],
      },
    ],
  },
]

/*
 * More sites, most of them with a handful of sheets. Their sheets are gathered by subject
 * (views first), and every group says which site it comes from.
 */

const DIBUJO_RAMON: ExerciseSource = {
  id: 'dibujoramon',
  title: 'Dibujo Ramón',
  site: 'dibujoramon.wordpress.com',
  baseUrl: 'https://dibujoramon.wordpress.com/wp-content/uploads/',
}

const ESCUADRA_CREATIVA: ExerciseSource = {
  id: 'laescuadracreativa',
  title: 'La escuadra creativa',
  site: 'laescuadracreativa.wordpress.com',
  baseUrl: 'https://laescuadracreativa.wordpress.com/wp-content/uploads/',
}

const EPV_VISUAL: ExerciseSource = {
  id: 'educacionplasticayvisual',
  title: 'Educación Plástica y Visual',
  site: 'educacionplasticayvisual.com',
  baseUrl: 'https://educacionplasticayvisual.com/wp-content/uploads/',
}

const TECNORINCON: ExerciseSource = {
  id: 'tecnorincon',
  title: 'Tecnorincón',
  site: 'tecnorincon.jimdofree.com',
  baseUrl: 'https://tecnorincon.jimdofree.com/app/download/',
}

const YOUR_TECHNOLOGY: ExerciseSource = {
  id: 'yourtechnologyweb',
  title: 'Your Technology Web',
  site: 'yourtechnologyweb.com',
  baseUrl: 'https://www.yourtechnologyweb.com/wp-content/uploads/',
}

const MARE_NOSTRUM: ExerciseSource = {
  id: 'iesmarenostrum',
  title: 'IES Mare Nostrum · Tecnología',
  site: 'iesmarenostrum.com',
  baseUrl: 'https://www.iesmarenostrum.com/departamentos/tecnologia/',
}

const ARZOBISPO_LOZANO: ExerciseSource = {
  id: 'iesarzobispolozano',
  title: 'IES Arzobispo Lozano · Tecnologías',
  site: 'murciaeduca.es',
  baseUrl: 'https://www.murciaeduca.es/iesarzobispolozano/sitio/upload/',
}

const AS_REVOLTAS: ExerciseSource = {
  id: 'cpiasrevoltas',
  title: 'CPI As Revoltas',
  site: 'edu.xunta.gal',
  baseUrl: 'https://www.edu.xunta.gal/centros/cpiasrevoltas/system/files/',
}

const JUAN_GRIS: ExerciseSource = {
  id: 'iesjuangris',
  title: 'IES Juan Gris',
  site: 'iesjuangris.com',
  baseUrl: 'https://www.iesjuangris.com/images/',
}

const ALFREDO_DIBUJO: ExerciseSource = {
  id: 'alfredodibujo',
  title: 'Alfredo Dibujo',
  site: 'alfredodibujo.wordpress.com',
  baseUrl: 'https://alfredodibujo.wordpress.com/wp-content/uploads/',
}

const FCEIA: ExerciseSource = {
  id: 'fceia',
  title: 'FCEIA · Universidad Nacional de Rosario',
  site: 'fceia.unr.edu.ar',
  baseUrl: 'https://www.fceia.unr.edu.ar/dibujo/',
}

const OCW_UNICAN: ExerciseSource = {
  id: 'ocwunican',
  title: 'OCW · Universidad de Cantabria',
  site: 'ocw.unican.es',
  baseUrl: 'https://ocw.unican.es/pluginfile.php/2058/course/section/1800/',
}

const AGUSTIN_DE_LA_TORRE: ExerciseSource = {
  id: 'agustindelatorre',
  title: 'Agustín de la Torre',
  site: 'agustindelatorre.com',
  baseUrl: 'https://agustindelatorre.com/wp-content/uploads/',
}

const FRANM: ExerciseSource = {
  id: 'franmdibujotecnico',
  title: 'Dibujo Técnico · blogsaverroes',
  site: 'blogsaverroes.juntadeandalucia.es',
  baseUrl: 'https://blogsaverroes.juntadeandalucia.es/franmdibujotecnico/files/',
}

const NUBE_ARTISTICA: ExerciseSource = {
  id: 'lanubeartistica',
  title: 'La nube artística',
  site: 'lanubeartistica.es',
  baseUrl: 'https://www.lanubeartistica.es/Dibujo_Tecnico_Primero/',
}

const ECOBLOG_CANARIAS: ExerciseSource = {
  id: 'ecoblogcanarias',
  title: 'Ecoblog · Gobierno de Canarias',
  site: 'gobiernodecanarias.org',
  baseUrl: 'https://www3.gobiernodecanarias.org/medusa/ecoblog/mmormarf/files/',
}

const MAREA_VERDE: ExerciseSource = {
  id: 'apuntesmareaverde',
  title: 'Apuntes Marea Verde',
  site: 'apuntesmareaverde.org.es',
  baseUrl: 'https://www.apuntesmareaverde.org.es/grupos/tec/loe/',
}

const DIBQR: ExerciseSource = {
  id: 'dibqr',
  title: 'DibQR · Dibujo Técnico Bachillerato',
  site: 'dibqr.com',
  baseUrl: 'https://dibqr.com/wp-content/uploads/',
}

const DT_I_Y_II: ExerciseSource = {
  id: 'dibujotecnicoiyii',
  title: 'Dibujo Técnico I y II',
  site: 'dibujotecnicoiyii.wordpress.com',
  baseUrl: 'https://dibujotecnicoiyii.wordpress.com/wp-content/uploads/',
}

/** Topics by subject, with sheets from several sites. */
const THEME_TOPICS: readonly ExerciseTopic[] = [
  {
    title: 'Vistas de piezas',
    groups: [
      {
        title: 'educacionplastica.net · red cúbica',
        source: EDUCACION_PLASTICA,
        exercises: [
          { name: 'Red 2×2×2: 16 ejercicios (nueva versión)', file: 'ejercicios_vistas_2x2x2_QR.pdf' },
          { name: 'Red 2×2×2: 12 ejercicios (versión antigua)', file: 'vistas.pdf' },
          { name: 'Red 3×3×3: 12 ejercicios (nueva versión)', file: 'ejercicios_vistas_3x3x3_QR.pdf' },
          { name: 'Red 3×3×3: 8 ejercicios (versión antigua)', file: 'vistas2.pdf' },
        ],
      },
      {
        title: 'dibujotecnico.com',
        source: DIBUJOTECNICO_COM,
        exercises: [
          { name: '10 piezas en isométrico para obtener sus vistas (volumen 1)', file: 'doc_3_1.pdf' },
          { name: 'Volumen 1: soluciones', file: 'doc_3_2.pdf' },
          { name: '10 piezas en isométrico para obtener sus vistas (volumen 2)', file: 'doc_3_3.pdf' },
          { name: 'Volumen 2: soluciones', file: 'doc_3_4.pdf' },
          { name: '24 ejercicios de obtención de las vistas de una pieza', file: 'doc_3_5.pdf' },
        ],
      },
      {
        title: 'laslaminas.es',
        source: LAS_LAMINAS,
        exercises: [
          { name: 'Seis láminas de vistas', file: 'descargas/vistas/seis_laminas_vistas.pdf' },
          { name: 'Lámina explicada: las tres vistas', file: 'descargas/vistas/explicacion_lamina_tres_vistas.pdf' },
        ],
      },
      {
        title: 'educacionplasticayvisual.com',
        source: EPV_VISUAL,
        exercises: [
          { name: 'Lámina de vistas diédricas 1', file: 'Axonometrico-vistas-diedricas-2x2-01-EPVA.pdf' },
          { name: 'Lámina de vistas diédricas 2', file: 'Axonometrico-vistas-diedricas-2x2-02-EPVA.pdf' },
        ],
      },
      {
        title: 'dibujoramon.wordpress.com',
        source: DIBUJO_RAMON,
        exercises: [
          { name: 'Vistas diédricas de piezas', file: '2019/11/vistasdepiezas.pdf' },
          { name: 'De perspectiva a vistas', file: '2022/03/perspectiva-a-vistasdepiezas-3.pdf' },
        ],
      },
      {
        title: 'tecnorincon.jimdofree.com',
        source: TECNORINCON,
        exercises: [
          { name: 'Vistas', file: '11139861295/Vistas.pdf' },
          { name: 'Vistas 1', file: '11270840495/vistas1.pdf' },
          { name: 'Vistas 2', file: '11270841195/vistas2.pdf' },
          { name: 'Vistas planas y acotación', file: '11385563195/VISTAS+PLANAS-ACOTACI%C3%93N.pdf' },
        ],
      },
      {
        title: 'yourtechnologyweb.com',
        source: YOUR_TECHNOLOGY,
        exercises: [
          { name: 'Vistas 1 (3º ESO)', file: '2020/06/vistas_1_pdf_3%C2%BAESO.pdf' },
        ],
      },
      {
        title: 'IES Mare Nostrum',
        source: MARE_NOSTRUM,
        exercises: [
          { name: 'Ejercicios de vistas 5–8: alzado, planta y perfil', file: 'ejercicios_de_vistas5-8.pdf' },
        ],
      },
      {
        title: 'IES Arzobispo Lozano',
        source: ARZOBISPO_LOZANO,
        exercises: [
          { name: 'Dibuja las vistas de las siguientes piezas', file: 'trabajo_recuperacion_tecno.pdf' },
        ],
      },
      {
        title: 'CPI As Revoltas',
        source: AS_REVOLTAS,
        exercises: [
          { name: 'Láminas de vistas, caballera e isométrica (2º ESO)', file: 'diedrico.pdf' },
        ],
      },
      {
        title: 'Ecoblog · Gobierno de Canarias',
        source: ECOBLOG_CANARIAS,
        exercises: [
          { name: 'Vistas y soluciones (1º ESO)', file: '2015/02/1eso-vistas-y-soluciones.pdf' },
        ],
      },
      {
        title: 'FCEIA · Universidad Nacional de Rosario',
        source: FCEIA,
        exercises: [
          { name: 'Lectura de vistas', file: 'LecturadeVistas.pdf' },
        ],
      },
      {
        title: 'OCW · Universidad de Cantabria',
        source: OCW_UNICAN,
        exercises: [
          { name: 'Dibujo técnico: ejercicios de vistas, cortes y perspectivas', file: '5EjercDibTec.pdf' },
        ],
      },
    ],
  },
  {
    title: 'Perspectivas: isométrica y caballera',
    groups: [
      {
        title: 'dibujoramon.wordpress.com',
        source: DIBUJO_RAMON,
        exercises: [
          { name: 'De vistas diédricas a perspectiva', file: '2022/04/ejercicios-vistas-a-perspectiva-1.pdf' },
        ],
      },
      {
        title: 'alfredodibujo.wordpress.com',
        source: ALFREDO_DIBUJO,
        exercises: [
          { name: 'De vistas a isométrica: soluciones', file: '2018/11/vistas-dic3a9drico-a-axonomc3a9trico-soluciones.pdf' },
        ],
      },
      {
        title: 'blogsaverroes · Dibujo Técnico',
        source: FRANM,
        exercises: [
          { name: 'Sistema axonométrico: de vistas a piezas', file: '2021/02/SISTEMA-AXONOM%C3%89TRICO-06-de-vistas-a-piezas.pdf' },
        ],
      },
      {
        title: 'IES Juan Gris',
        source: JUAN_GRIS,
        exercises: [
          { name: 'Prácticas de perspectiva isométrica', file: 'Practicas_perspectiva_isometrica_copia.pdf' },
        ],
      },
      {
        title: 'educacionplastica.net',
        source: EDUCACION_PLASTICA,
        exercises: [
          { name: 'Ejercicios de perspectiva isométrica', file: 'vistas_iso1.pdf' },
          { name: 'Cuaderno de ejercicios de isométrica', file: 'vistas_iso2.pdf' },
          { name: 'Plantilla isométrica', file: 'RedIsometrica.pdf' },
        ],
      },
      {
        title: 'lanubeartistica.es',
        source: NUBE_ARTISTICA,
        exercises: [
          { name: 'Sistemas de representación (II): isometría', file: 'isometria/DT1_U4_T2_imprimible_v1.pdf' },
          { name: 'Axonometría oblicua: caballera', file: 'caballera/DT1_U4_T3_imprimible_v1.pdf' },
        ],
      },
      {
        title: 'laslaminas.es',
        source: LAS_LAMINAS,
        exercises: [
          { name: 'Apuntes de axonométrica ortogonal', file: 'descargas/axonometricas/axonometrica_ortogonal.pdf' },
          { name: 'Láminas de axonométricas', file: 'descargas/axonometricas/axo_pto_recta_plano_laminas.pdf' },
          { name: 'Láminas de axonométricas: soluciones', file: 'descargas/axonometricas/axo_pto_recta_plano_soluciones.pdf' },
          { name: 'Láminas con plantillas isométricas', file: 'descargas/axonometricas/plantillas_isometricas.pdf' },
          { name: 'Casitas en isométrica', file: 'descargas/axonometricas/edificios_isometrica_laminas.pdf' },
          { name: 'Casitas en isométrica: soluciones', file: 'descargas/axonometricas/edificios_isometrica_soluciones.pdf' },
          { name: 'Apuntes sobre perspectiva caballera', file: 'descargas/axonometricas/caballera.pdf' },
        ],
      },
    ],
  },
  {
    title: 'Normalización y acotación',
    groups: [
      {
        title: 'laslaminas.es',
        source: LAS_LAMINAS,
        exercises: [
          { name: 'Introducción a la representación normalizada', file: 'descargas/normalizacion/normalizacion_vistas.pdf' },
          { name: 'Rotulación y líneas normalizadas', file: 'descargas/normalizacion/rotu_lineas_normalizadas.pdf' },
          { name: 'Láminas normalizadas A4', file: 'descargas/normalizacion/laminas_Acuatro_normalizadas.pdf' },
          { name: 'Láminas normalizadas A3', file: 'descargas/normalizacion/laminas_Atres_normalizadas.pdf' },
        ],
      },
      {
        title: 'dibujotecnicoiyii.wordpress.com',
        source: DT_I_Y_II,
        exercises: [
          { name: 'Acotación', file: '2013/11/acotacion1.pdf' },
        ],
      },
      {
        title: 'apuntesmareaverde.org.es',
        source: MAREA_VERDE,
        exercises: [
          { name: 'La expresión gráfica y la comunicación de ideas (1º ESO)', file: '1eso/dibujo.pdf' },
        ],
      },
    ],
  },
  {
    title: 'Sistema diédrico',
    groups: [
      {
        title: 'laslaminas.es · punto, recta y plano',
        source: LAS_LAMINAS,
        exercises: [
          { name: 'Introducción al diédrico', file: 'descargas/diedrico/punto_recta_plano.pdf' },
          { name: 'Láminas de punto, recta y plano', file: 'descargas/diedrico/punto_recta_plano_laminas.pdf' },
          { name: 'Láminas de punto, recta y plano: soluciones', file: 'descargas/diedrico/punto_recta_plano_laminas_solu.pdf' },
        ],
      },
      {
        title: 'laslaminas.es · intersecciones',
        source: LAS_LAMINAS,
        exercises: [
          { name: 'Intersecciones', file: 'descargas/diedrico/intersecciones.pdf' },
          { name: 'Láminas de intersecciones', file: 'descargas/diedrico/intersecciones_laminas.pdf' },
          { name: 'Láminas de intersecciones: soluciones', file: 'descargas/diedrico/intersecciones_laminas_solu.pdf' },
        ],
      },
      {
        title: 'laslaminas.es · abatimientos',
        source: LAS_LAMINAS,
        exercises: [
          { name: 'Abatimientos', file: 'descargas/diedrico/abatimientos.pdf' },
          { name: 'Láminas sobre abatimientos', file: 'descargas/diedrico/abatimientos_laminas.pdf' },
          { name: 'Láminas sobre abatimientos: soluciones', file: 'descargas/diedrico/abatimientos_laminas_solu.pdf' },
        ],
      },
      {
        title: 'laslaminas.es · secciones planas',
        source: LAS_LAMINAS,
        exercises: [
          { name: 'Secciones', file: 'descargas/diedrico/secciones_planas.pdf' },
          { name: 'Láminas de secciones planas', file: 'descargas/diedrico/secciones_planas_laminas.pdf' },
          { name: 'Láminas de secciones planas: soluciones', file: 'descargas/diedrico/secciones_planas_laminas_solu.pdf' },
        ],
      },
      {
        title: 'laslaminas.es · paralelismo y perpendicularidad',
        source: LAS_LAMINAS,
        exercises: [
          { name: 'Paralelismo y perpendicularidad', file: 'descargas/diedrico/paralelismo_perpendicularidad.pdf' },
          { name: 'Láminas de paralelismo y perpendicularidad', file: 'descargas/diedrico/paralelismo_perpendicularidad_laminas.pdf' },
          { name: 'Láminas de paralelismo y perpendicularidad: soluciones', file: 'descargas/diedrico/paralelismo_perpendicularidad_laminas_solu.pdf' },
        ],
      },
      {
        title: 'laslaminas.es · distancias',
        source: LAS_LAMINAS,
        exercises: [
          { name: 'Distancias', file: 'descargas/diedrico/distancias.pdf' },
          { name: 'Láminas de distancias', file: 'descargas/diedrico/distancias_laminas.pdf' },
          { name: 'Láminas de distancias: soluciones', file: 'descargas/diedrico/distancias_laminas_solu.pdf' },
        ],
      },
      {
        title: 'laslaminas.es · giros',
        source: LAS_LAMINAS,
        exercises: [
          { name: 'Giros', file: 'descargas/diedrico/giros.pdf' },
          { name: 'Láminas de giros', file: 'descargas/diedrico/giros_laminas.pdf' },
          { name: 'Láminas de giros: soluciones', file: 'descargas/diedrico/giros_laminas_solu.pdf' },
        ],
      },
      {
        title: 'laslaminas.es · cambios de plano',
        source: LAS_LAMINAS,
        exercises: [
          { name: 'Cambios de plano', file: 'descargas/diedrico/cambios_de_plano.pdf' },
          { name: 'Láminas de cambios de plano', file: 'descargas/diedrico/cambios_de_plano_laminas.pdf' },
          { name: 'Láminas de cambios de plano: soluciones', file: 'descargas/diedrico/cambios_de_plano_laminas_solu.pdf' },
        ],
      },
      {
        title: 'laescuadracreativa.wordpress.com',
        source: ESCUADRA_CREATIVA,
        exercises: [
          { name: 'Ejercicios diédrico: Rectas I', file: '2019/01/ejercicios-rectas-diedrico-i-1.pdf' },
          { name: 'Ejercicios diédrico: Rectas II', file: '2019/01/ejercicios-rectas-diedrico-ii.pdf' },
          { name: 'Ejercicios diédrico: Pertenencias', file: '2019/01/ejercicios-pertenencia.pdf' },
          { name: 'Ejercicios diédrico: Planos', file: '2019/01/ejercicios-planos.pdf' },
          { name: 'Repaso diédrico: lámina 1', file: '2020/06/repaso-dic3a9drico-lc3a1mina-1.pdf' },
          { name: 'Repaso diédrico: lámina 2', file: '2020/06/repaso-dic3a9drico-lc3a1mina-2.pdf' },
          { name: 'Repaso diédrico: lámina 3', file: '2020/06/repaso-dic3a9drico-lc3a1mina-3.pdf' },
          { name: 'Repaso diédrico: lámina 4', file: '2020/06/repaso-dic3a9drico-lc3a1mina-4.pdf' },
          { name: 'Repaso diédrico: lámina 5', file: '2020/06/repaso-dic3a9drico-lc3a1mina-5.pdf' },
          { name: 'Repaso diédrico: lámina 6', file: '2020/06/repaso-dic3a9drico-lc3a1mina-6.pdf' },
          { name: 'Repaso diédrico: lámina 7', file: '2020/06/repaso-dic3a9drico-lc3a1mina-7.pdf' },
          { name: 'Repaso diédrico: lámina 8', file: '2020/06/repaso-dic3a9drico-lc3a1mina-8.pdf' },
          { name: 'Repaso diédrico: lámina 9', file: '2020/06/repaso-dic3a9drico-lc3a1mina-9.pdf' },
          { name: 'Repaso diédrico: lámina 10', file: '2020/06/repaso-dic3a9drico-lc3a1mina-10.pdf' },
        ],
      },
    ],
  },
  {
    title: 'Geometría plana',
    groups: [
      {
        title: 'laslaminas.es · trazados básicos',
        source: LAS_LAMINAS,
        exercises: [
          { name: 'Trazados básicos (apuntes)', file: 'descargas/trazados_basicos/trazados_basicos_todo_apts.pdf' },
          { name: 'Láminas de trazados básicos', file: 'descargas/trazados_basicos/laminas_trazados_geo_basicos_todo.pdf' },
          { name: 'Operaciones básicas con segmentos', file: 'descargas/trazados_basicos/trazados_basicos_segmentos.pdf' },
          { name: 'Lámina de operaciones básicas con segmentos', file: 'descargas/trazados_basicos/lamina_basicos_segmentos.pdf' },
          { name: 'Red de circunferencias', file: 'descargas/trazados_basicos/red_de_circunferencias.pdf' },
          { name: 'Triángulos y paralelas', file: 'descargas/trazados_basicos/triangulos_y_paralelas.pdf' },
          { name: 'Paralelismo y perpendicularidad', file: 'descargas/trazados_basicos/perpendicularidad_paralelismo.pdf' },
          { name: 'Lámina de paralelismo y perpendicularidad', file: 'descargas/trazados_basicos/lamina_perpendicularidad_paralelismo.pdf' },
          { name: 'Teorema de Thales de Mileto', file: 'descargas/trazados_basicos/aplicaciones_teorema_thales.pdf' },
          { name: 'Lámina de aplicaciones prácticas de Thales', file: 'descargas/trazados_basicos/lamina_aplicacion_teorema_thales.pdf' },
          { name: 'Lámina de uso de las escuadras', file: 'descargas/trazados_basicos/lamina_escuadra_y_cartabon.pdf' },
          { name: 'Conceptos fundamentales de ángulos', file: 'descargas/trazados_basicos/angulos_fundamentos_teoricos.pdf' },
          { name: 'Operaciones básicas con ángulos', file: 'descargas/trazados_basicos/angulos_operaciones_basicas.pdf' },
          { name: 'Lámina de operaciones básicas con ángulos', file: 'descargas/trazados_basicos/lamina_angulos_operaciones_basicas.pdf' },
          { name: 'Arco capaz', file: 'descargas/trazados_basicos/arco_capaz.pdf' },
          { name: 'Bisectrices de ángulos especiales y recta concurrente', file: 'descargas/trazados_basicos/angulos_especiales_recta_concurrente.pdf' },
          { name: 'Lámina de arco capaz y recta concurrente', file: 'descargas/trazados_basicos/lamina_arco_capaz_recta_concurrente.pdf' },
          { name: 'Circunferencia que pasa por tres puntos y rectificación', file: 'descargas/trazados_basicos/circunferencia_tres_ptos_rectificacion.pdf' },
        ],
      },
      {
        title: 'laslaminas.es · polígonos',
        source: LAS_LAMINAS,
        exercises: [
          { name: 'Conceptos fundamentales de los polígonos', file: 'descargas/poligonos/conceptos_basicos_poligonos.pdf' },
          { name: 'Copia de polígonos', file: 'descargas/poligonos/poligonos_copia.pdf' },
          { name: 'Lámina de copia de polígonos', file: 'descargas/poligonos/poligonos_copia_lamina.pdf' },
          { name: 'Triángulos', file: 'descargas/poligonos/triangulos_conceptos_construcciones.pdf' },
          { name: 'Láminas de construcción de triángulos', file: 'descargas/poligonos/triangulos_laminas.pdf' },
          { name: 'Láminas de triángulos: soluciones', file: 'descargas/poligonos/triangulos_laminas_soluciones.pdf' },
          { name: 'Cuadriláteros', file: 'descargas/poligonos/cuadrilateros_conceptos_construcciones.pdf' },
          { name: 'Rectángulos notables', file: 'descargas/proporcionalidad/proporciones_notables.pdf' },
          { name: 'Láminas de construcciones de cuadriláteros', file: 'descargas/poligonos/cuadrilateros_laminas.pdf' },
          { name: 'Láminas de cuadriláteros: soluciones', file: 'descargas/poligonos/cuadrilateros_solus_R.pdf' },
          { name: 'Polígonos regulares', file: 'descargas/poligonos/poligonos_regulares_construcciones.pdf' },
          { name: 'Láminas de polígonos regulares', file: 'descargas/poligonos/poligonos_regulares_laminas.pdf' },
          { name: 'Polígonos estrellados', file: 'descargas/poligonos/poligonos_estrellados.pdf' },
          { name: 'Lámina de polígonos estrellados', file: 'descargas/poligonos/poligonos_estrellados_lamina.pdf' },
          { name: 'Polígonos equivalentes', file: 'descargas/poligonos/poligonos_equivalencias.pdf' },
        ],
      },
      {
        title: 'dibujotecnico.com',
        source: DIBUJOTECNICO_COM,
        exercises: [
          { name: '23 ejercicios sobre construcción de triángulos', file: 'doc_1_03.pdf' },
          { name: '24 ejercicios sobre construcción de cuadriláteros', file: 'doc_1_04.pdf' },
        ],
      },
    ],
  },
  {
    title: 'Tangencias y curvas',
    groups: [
      {
        title: 'laslaminas.es · tangencias',
        source: LAS_LAMINAS,
        exercises: [
          { name: 'Tangencias básicas', file: 'descargas/tangencias/tangencias_basicas.pdf' },
          { name: '23 láminas de tangencias básicas', file: 'descargas/tangencias/laminas_tg_basicas.pdf' },
          { name: 'Las 23 láminas solucionadas', file: 'descargas/tangencias/laminas_tg_basicas_solu.pdf' },
          { name: '8 láminas de piezas con tangencias básicas', file: 'descargas/tangencias/laminas_piezas_tg_basicas.pdf' },
          { name: 'Las 8 láminas solucionadas', file: 'descargas/tangencias/laminas_piezas_tg_basicas_solu.pdf' },
        ],
      },
      {
        title: 'laslaminas.es · Apolonio',
        source: LAS_LAMINAS,
        exercises: [
          { name: 'Apolonio: introducción (PPP y RRR)', file: 'descargas/tangencias/Apolonio/apolonio_intro_ppp_rrr.pdf' },
          { name: 'Apolonio: PPR', file: 'descargas/tangencias/Apolonio/apolonio_ppr.pdf' },
          { name: 'Apolonio: RRP', file: 'descargas/tangencias/Apolonio/apolonio_rrp.pdf' },
          { name: 'Apolonio: RRC', file: 'descargas/tangencias/Apolonio/apolonio_rrc.pdf' },
          { name: 'Apolonio: CPP', file: 'descargas/tangencias/Apolonio/apolonio_cpp.pdf' },
          { name: 'Apolonio: CPR', file: 'descargas/tangencias/Apolonio/apolonio_cpr.pdf' },
          { name: 'Apolonio: CCP', file: 'descargas/tangencias/Apolonio/apolonio_ccp.pdf' },
          { name: 'Apolonio: 10 láminas para practicar', file: 'descargas/tangencias/Apolonio/apolonio_laminas.pdf' },
          { name: 'Apolonio: láminas solucionadas', file: 'descargas/tangencias/Apolonio/apolonio_laminas_solu.pdf' },
        ],
      },
      {
        title: 'dibqr.com',
        source: DIBQR,
        exercises: [
          { name: '20 láminas de tangencias básicas', file: '2024/11/Tangencias-Basicas-1DT-DibQr-Dibujo-Tecnico-Bachillerato.pdf' },
        ],
      },
      {
        title: 'laescuadracreativa.wordpress.com',
        source: ESCUADRA_CREATIVA,
        exercises: [
          { name: 'Relación de ejercicios de tangencias (1º Bach)', file: '2018/11/relacic3b3n-ejercicios-tangencias.pdf' },
          { name: 'Ejercicio de figura con tangencias (2014)', file: '2018/11/ejercicio-figura-tangencias_2014_21.pdf' },
          { name: 'Ejercicio de figura con tangencias (2015)', file: '2018/11/ejercicio-figura-tangencias_2015.pdf' },
          { name: 'Ejercicio de figura con tangencias (2016)', file: '2018/11/ejercicio-figura-tangencias_2016.pdf' },
          { name: 'Ejercicio de figura con tangencias (2016, 2)', file: '2018/11/ejercicio-figura-tangencias_2_20161.pdf' },
          { name: 'Ejercicio de elipse (2008)', file: '2018/10/ejercicio-elipse_20081.pdf' },
          { name: 'Ejercicio de elipse (2011)', file: '2018/10/ejercicio-elipse_20111.pdf' },
          { name: 'Ejercicio de elipse (2012)', file: '2018/10/ejercicio-elipse_20121.pdf' },
        ],
      },
      {
        title: 'dibujoramon.wordpress.com',
        source: DIBUJO_RAMON,
        exercises: [
          { name: 'Problemas de figuras inversas', file: '2022/12/problemas-de-figuras-inversas-2.pdf' },
          { name: 'Lámina de cónicas: soluciones', file: '2023/02/lamina-conicas-soluciones.pdf' },
        ],
      },
    ],
  },
  {
    title: 'Perspectiva cónica y sólidos',
    groups: [
      {
        title: 'laslaminas.es · perspectiva cónica',
        source: LAS_LAMINAS,
        exercises: [
          { name: 'Apuntes de perspectiva cónica', file: 'descargas/conica/conica.pdf' },
          { name: 'Láminas básicas de perspectiva cónica', file: 'descargas/conica/conica_laminas.pdf' },
          { name: 'Láminas básicas: soluciones', file: 'descargas/conica/conica_laminas_solu.pdf' },
          { name: 'Perspectiva cónica en diédrico', file: 'descargas/conica/conica_en_diedrico.pdf' },
          { name: 'Láminas: diédrico versus cónica', file: 'descargas/conica/conica_en_diedrico_laminas.pdf' },
          { name: 'Láminas diédrico versus cónica: soluciones', file: 'descargas/conica/conica_en_diedrico_laminas_solu.pdf' },
          { name: 'Láminas: caballera versus cónica', file: 'descargas/conica/conica_axonometrica_laminas.pdf' },
          { name: 'Láminas caballera versus cónica: soluciones', file: 'descargas/conica/conica_axonometrica_laminas_solu.pdf' },
        ],
      },
      {
        title: 'laslaminas.es · sólidos',
        source: LAS_LAMINAS,
        exercises: [
          { name: 'Sólidos platónicos y secciones principales', file: 'descargas/superficies-y-solidos/secciones_principales_platonicos_R.pdf' },
          { name: 'Desarrollos de los sólidos platónicos', file: 'descargas/superficies-y-solidos/desarrollos_solidos_platonicos.pdf' },
          { name: 'Desarrollos de los sólidos arquimedianos', file: 'descargas/superficies-y-solidos/desarrollos_solidos_arquimedianos.pdf' },
        ],
      },
    ],
  },
  {
    title: 'Cuadernos y repasos',
    groups: [
      {
        title: 'agustindelatorre.com',
        source: AGUSTIN_DE_LA_TORRE,
        exercises: [
          { name: 'Láminas de Dibujo Técnico 1º Bachillerato', file: '2019/12/laminas-dibujo-tecnico-1%C2%BA-Bachiller.pdf' },
        ],
      },
      {
        title: 'dibujoramon.wordpress.com',
        source: DIBUJO_RAMON,
        exercises: [
          { name: 'Ejercicios de Dibujo Técnico II', file: '2022/10/ejercicios-dibujo-tecnico-ii.pdf' },
          { name: 'Ejercicios de Dibujo Técnico II (hasta el 15)', file: '2022/11/ejercicios_hasta_15.pdf' },
          { name: 'Dibujo Técnico II: lámina 01', file: '2022/10/dtii_lamina01.pdf' },
          { name: 'Dibujo Técnico II: lámina 02', file: '2022/10/dtii_lamina02.pdf' },
        ],
      },
      {
        title: 'laescuadracreativa.wordpress.com',
        source: ESCUADRA_CREATIVA,
        exercises: [
          { name: 'Repaso 1º trimestre (1º Bach)', file: '2020/06/repaso-1c2ba-trimestre.pdf' },
          { name: 'Refuerzo tema 8', file: '2020/02/refuerzo-tema-8.pdf' },
        ],
      },
    ],
  },
]

export const OTHER_TOPICS: readonly ExerciseTopic[] = [...THEME_TOPICS, ...SITE_TOPICS]

/** Every site the other topics draw from. */
export const OTHER_SOURCES: readonly ExerciseSource[] = [
  LAS_LAMINAS,
  IBAIGUREN,
  DIBUJOTECNICO_COM,
  EDUCACION_PLASTICA,
  DIBUJO_RAMON,
  ESCUADRA_CREATIVA,
  EPV_VISUAL,
  TECNORINCON,
  YOUR_TECHNOLOGY,
  MARE_NOSTRUM,
  ARZOBISPO_LOZANO,
  AS_REVOLTAS,
  JUAN_GRIS,
  ALFREDO_DIBUJO,
  FCEIA,
  OCW_UNICAN,
  AGUSTIN_DE_LA_TORRE,
  FRANM,
  NUBE_ARTISTICA,
  ECOBLOG_CANARIAS,
  MAREA_VERDE,
  DIBQR,
  DT_I_Y_II,
]
