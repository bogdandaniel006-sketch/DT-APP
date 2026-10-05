/**
 * Exercise library: an index of the sheets published at dtecnico.com by Diego de Miguel.
 * Nothing is copied into this project: every sheet is fetched from the original when opened.
 * To add a sheet, add a line here — the interface needs no change.
 */

export interface Exercise {
  name: string
  /** Path of the PDF, relative to the source's base URL. */
  file: string
}

export interface ExerciseGroup {
  title: string
  exercises: readonly Exercise[]
}

export interface ExerciseTopic {
  title: string
  groups: readonly ExerciseGroup[]
}

export const EXERCISE_SOURCE = {
  title: 'Dibujo Técnico',
  author: 'Diego de Miguel',
  site: 'dtecnico.com',
  /** The site is only served over http. */
  baseUrl: 'http://dtecnico.com/',
} as const

/** The original PDF, on the source's own site. */
export const exerciseUrl = (exercise: Exercise) => EXERCISE_SOURCE.baseUrl + exercise.file

/** The same PDF handed over by this site, so the app can open it on the desk. */
export const exerciseLocalUrl = (exercise: Exercise) => '/ejercicios/' + exercise.file

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
