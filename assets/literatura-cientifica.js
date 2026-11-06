(() => {
  "use strict";

  const API_ROOT = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/";
  const PAGE_SIZE = 10;
  const MIN_REQUEST_INTERVAL = 420;
  const publicationTypes = {
    systematic: '"systematic review"[Publication Type]',
    meta: '"meta-analysis"[Publication Type]',
    rct: '"randomized controlled trial"[Publication Type]',
    clinical: '"clinical trial"[Publication Type]',
    review: '"review"[Publication Type]',
    case: '"case reports"[Publication Type]',
    guideline: '"practice guideline"[Publication Type]'
  };

  const form = document.getElementById("pubmedForm");
  const queryInput = document.getElementById("pubmedQuery");
  const dateFilter = document.getElementById("dateFilter");
  const typeFilter = document.getElementById("typeFilter");
  const sortFilter = document.getElementById("sortFilter");
  const searchButton = document.getElementById("searchButton");
  const loadMoreButton = document.getElementById("loadMoreButton");
  const resultsList = document.getElementById("resultsList");
  const resultsSummary = document.getElementById("resultsSummary");
  const searchStatus = document.getElementById("searchStatus");
  const navToggle = document.getElementById("navToggle");
  const primaryNav = document.getElementById("primaryNav");

  const state = {
    query: "",
    date: "all",
    type: "",
    sort: "relevance",
    offset: 0,
    total: 0,
    loading: false
  };

  let lastRequestAt = 0;

  function setStatus(message, isError) {
    searchStatus.textContent = message;
    searchStatus.classList.toggle("error", Boolean(isError));
  }

  function wait(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  async function fetchNCBI(url, responseType) {
    const elapsed = Date.now() - lastRequestAt;
    if (elapsed < MIN_REQUEST_INTERVAL) {
      await wait(MIN_REQUEST_INTERVAL - elapsed);
    }
    lastRequestAt = Date.now();

    const response = await fetch(url, {
      method: "GET",
      mode: "cors",
      credentials: "omit",
      headers: { "Accept": responseType === "json" ? "application/json" : "application/xml, text/xml" }
    });

    if (!response.ok) {
      throw new Error("NCBI respondió con el estado " + response.status + ".");
    }
    return responseType === "json" ? response.json() : response.text();
  }

  function formatNCBIDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return year + "/" + month + "/" + day;
  }

  function buildSearchURL(offset) {
    let term = state.query;
    if (state.type && publicationTypes[state.type]) {
      term = "(" + term + ") AND " + publicationTypes[state.type];
    }

    const params = new URLSearchParams({
      db: "pubmed",
      term: term,
      retmode: "json",
      retmax: String(PAGE_SIZE),
      retstart: String(offset),
      sort: state.sort,
      tool: "OdontoUdeC"
    });

    if (state.date !== "all") {
      const years = Number(state.date);
      const today = new Date();
      const from = new Date(today);
      from.setFullYear(from.getFullYear() - years);
      params.set("datetype", "pdat");
      params.set("mindate", formatNCBIDate(from));
      params.set("maxdate", formatNCBIDate(today));
    }

    return API_ROOT + "esearch.fcgi?" + params.toString();
  }

  function nodeText(node) {
    return node ? String(node.textContent || "").replace(/\s+/g, " ").trim() : "";
  }

  function firstText(parent, selector) {
    return nodeText(parent ? parent.querySelector(selector) : null);
  }

  function parseArticles(xmlText) {
    const documentXML = new DOMParser().parseFromString(xmlText, "application/xml");
    if (documentXML.querySelector("parsererror")) {
      throw new Error("No se pudo interpretar la respuesta bibliográfica de NCBI.");
    }

    const nodes = Array.from(documentXML.getElementsByTagName("PubmedArticle"));
    if (!nodes.length && documentXML.getElementsByTagName("ERROR").length) {
      throw new Error("NCBI no pudo recuperar los registros solicitados.");
    }

    return nodes.map((node) => {
      const citation = node.getElementsByTagName("MedlineCitation")[0];
      const article = citation ? citation.getElementsByTagName("Article")[0] : null;
      const pmid = firstText(citation, "PMID");
      const title = firstText(article, "ArticleTitle") || "Título no disponible";
      const journal = firstText(article, "Journal > Title") || "Revista no especificada";
      const pubDate = article ? article.getElementsByTagName("PubDate")[0] : null;
      const articleDate = article ? article.getElementsByTagName("ArticleDate")[0] : null;
      let year = firstText(pubDate, "Year") || firstText(articleDate, "Year");
      if (!year) {
        const medlineDate = firstText(pubDate, "MedlineDate");
        const match = medlineDate.match(/\b(19|20)\d{2}\b/);
        year = match ? match[0] : "Fecha no indicada";
      }

      const authorList = article ? article.getElementsByTagName("AuthorList")[0] : null;
      const authorNodes = authorList ? Array.from(authorList.getElementsByTagName("Author")) : [];
      const authors = authorNodes.map((author) => {
        const collective = firstText(author, "CollectiveName");
        if (collective) return collective;
        const last = firstText(author, "LastName");
        const initials = firstText(author, "Initials");
        return [last, initials].filter(Boolean).join(" ");
      }).filter(Boolean);
      let authorText = authors.slice(0, 4).join(", ");
      if (authors.length > 4) authorText += " y cols.";
      if (!authorText) authorText = "Autores no especificados en el registro";

      const abstractNodes = article ? Array.from(article.getElementsByTagName("AbstractText")) : [];
      const abstract = abstractNodes.map((item) => {
        const label = item.getAttribute("Label") || item.getAttribute("NlmCategory") || "";
        const value = nodeText(item);
        return value ? (label ? label + ": " : "") + value : "";
      }).filter(Boolean).join("\n\n");

      const idNodes = Array.from(node.getElementsByTagName("ArticleId"));
      const doiNode = idNodes.find((item) => (item.getAttribute("IdType") || "").toLowerCase() === "doi");
      const pmcNode = idNodes.find((item) => (item.getAttribute("IdType") || "").toLowerCase() === "pmc");
      const doi = nodeText(doiNode);
      const pmc = nodeText(pmcNode);
      const publicationTypesNodes = article ? Array.from(article.getElementsByTagName("PublicationType")) : [];
      const publicationLabels = publicationTypesNodes.slice(0, 2).map(nodeText).filter(Boolean);

      return {
        pmid: pmid,
        title: title,
        journal: journal,
        year: year,
        authors: authorText,
        abstract: abstract,
        doi: doi,
        pmc: pmc,
        publicationLabels: publicationLabels
      };
    }).filter((article) => article.pmid);
  }

  function makeLink(label, href, primary) {
    const link = document.createElement("a");
    link.href = href;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = label;
    if (primary) link.className = "primary-link";
    return link;
  }

  function renderArticle(item) {
    const card = document.createElement("article");
    card.className = "article-card";

    const meta = document.createElement("div");
    meta.className = "article-meta";
    const journalTag = document.createElement("span");
    journalTag.className = "article-tag";
    journalTag.textContent = item.journal;
    meta.appendChild(journalTag);

    const yearTag = document.createElement("span");
    yearTag.className = "article-tag gold";
    yearTag.textContent = item.year;
    meta.appendChild(yearTag);

    item.publicationLabels.forEach((label) => {
      const tag = document.createElement("span");
      tag.className = "article-tag";
      tag.textContent = label;
      meta.appendChild(tag);
    });

    const title = document.createElement("h3");
    title.textContent = item.title;

    const authors = document.createElement("p");
    authors.className = "article-authors";
    authors.textContent = item.authors;

    const journal = document.createElement("p");
    journal.className = "article-journal";
    journal.textContent = "PMID: " + item.pmid;

    const actions = document.createElement("div");
    actions.className = "article-actions";
    actions.appendChild(makeLink("Ver ficha en PubMed ↗", "https://pubmed.ncbi.nlm.nih.gov/" + encodeURIComponent(item.pmid) + "/", true));
    if (item.pmc) {
      const pmcId = item.pmc.startsWith("PMC") ? item.pmc : "PMC" + item.pmc;
      actions.appendChild(makeLink("Texto completo en PMC ↗", "https://pmc.ncbi.nlm.nih.gov/articles/" + encodeURIComponent(pmcId) + "/", false));
    }
    if (item.doi) {
      actions.appendChild(makeLink("Consultar DOI ↗", "https://doi.org/" + encodeURIComponent(item.doi), false));
    }

    card.append(meta, title, authors, journal);

    const details = document.createElement("details");
    details.className = "article-abstract";
    const summary = document.createElement("summary");
    summary.textContent = item.abstract ? "Leer resumen" : "Resumen no disponible en este registro";
    details.appendChild(summary);
    if (item.abstract) {
      const abstract = document.createElement("p");
      abstract.textContent = item.abstract;
      details.appendChild(abstract);
    }
    card.append(details, actions);
    return card;
  }

  function renderEmpty(title, message) {
    const box = document.createElement("div");
    box.className = "empty-state";
    const icon = document.createElement("div");
    icon.className = "empty-icon";
    icon.textContent = "⌕";
    const heading = document.createElement("h3");
    heading.textContent = title;
    const description = document.createElement("p");
    description.textContent = message;
    box.append(icon, heading, description);
    resultsList.replaceChildren(box);
  }

  function updateResultsSummary() {
    if (!state.total) {
      resultsSummary.textContent = "No se encontraron publicaciones.";
      return;
    }
    resultsSummary.textContent = "Mostrando " + Math.min(state.offset, state.total).toLocaleString("es-CO") +
      " de " + state.total.toLocaleString("es-CO") + " publicaciones.";
  }

  async function runSearch(append) {
    if (state.loading) return;

    if (!append) {
      const query = queryInput.value.trim();
      if (query.length < 2) {
        setStatus("Escribe al menos dos caracteres para buscar.", true);
        queryInput.focus();
        return;
      }
      state.query = query;
      state.date = dateFilter.value;
      state.type = typeFilter.value;
      state.sort = sortFilter.value;
      state.offset = 0;
      state.total = 0;
      resultsList.replaceChildren();
    }

    state.loading = true;
    searchButton.disabled = true;
    searchButton.textContent = "Buscando…";
    loadMoreButton.disabled = true;
    setStatus(append ? "Cargando más publicaciones desde PubMed…" : "Consultando PubMed y recuperando los registros…", false);

    try {
      const searchData = await fetchNCBI(buildSearchURL(state.offset), "json");
      const searchResult = searchData && searchData.esearchresult ? searchData.esearchresult : {};
      const ids = Array.isArray(searchResult.idlist) ? searchResult.idlist : [];
      state.total = Number(searchResult.count || 0);

      if (!ids.length) {
        if (!append) renderEmpty("No encontramos publicaciones", "Prueba con otros términos o amplía el rango de fechas.");
        state.offset = 0;
        updateResultsSummary();
        loadMoreButton.hidden = true;
        setStatus("Búsqueda completada. No hay registros para esos filtros.", false);
        return;
      }

      const fetchParams = new URLSearchParams({
        db: "pubmed",
        id: ids.join(","),
        retmode: "xml",
        tool: "OdontoUdeC"
      });
      const xml = await fetchNCBI(API_ROOT + "efetch.fcgi?" + fetchParams.toString(), "xml");
      const articles = parseArticles(xml);

      if (!articles.length) {
        throw new Error("PubMed encontró identificadores, pero no devolvió registros para mostrar.");
      }

      const fragment = document.createDocumentFragment();
      articles.forEach((item) => fragment.appendChild(renderArticle(item)));
      if (append) {
        resultsList.appendChild(fragment);
      } else {
        resultsList.replaceChildren(fragment);
      }

      state.offset += ids.length;
      updateResultsSummary();
      loadMoreButton.hidden = state.offset >= state.total;
      setStatus("Resultados obtenidos directamente de PubMed/NCBI. Revisa cada publicación en su ficha original.", false);
    } catch (error) {
      console.error("[OdontoUdeC PubMed]", error);
      setStatus("No pudimos completar la búsqueda. " + (error && error.message ? error.message : "Comprueba tu conexión e inténtalo de nuevo."), true);
      if (!append && !resultsList.children.length) {
        renderEmpty("No se pudo cargar PubMed", "Puedes volver a intentarlo en unos segundos o abrir PubMed directamente.");
      }
    } finally {
      state.loading = false;
      searchButton.disabled = false;
      searchButton.innerHTML = 'Buscar artículos <span aria-hidden="true">↗</span>';
      loadMoreButton.disabled = false;
    }
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    runSearch(false);
  });

  loadMoreButton.addEventListener("click", () => runSearch(true));

  document.querySelectorAll("[data-query]").forEach((button) => {
    button.addEventListener("click", () => {
      queryInput.value = button.getAttribute("data-query") || "";
      form.requestSubmit();
    });
  });

  if (navToggle && primaryNav) {
    navToggle.addEventListener("click", () => {
      const open = primaryNav.classList.toggle("open");
      navToggle.setAttribute("aria-expanded", String(open));
      navToggle.setAttribute("aria-label", open ? "Cerrar menú" : "Abrir menú");
      navToggle.textContent = open ? "×" : "☰";
    });
    primaryNav.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        primaryNav.classList.remove("open");
        navToggle.setAttribute("aria-expanded", "false");
        navToggle.setAttribute("aria-label", "Abrir menú");
        navToggle.textContent = "☰";
      });
    });
  }
})();