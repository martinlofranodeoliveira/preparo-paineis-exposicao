function isAsciiAlphaNumeric(code) {
  return (
    (code >= 48 && code <= 57) ||
    (code >= 65 && code <= 90) ||
    (code >= 97 && code <= 122)
  );
}

function isValidId(value) {
  if (typeof value !== "string") {
    return false;
  }
  if (value.length < 1 || value.length > 32) {
    return false;
  }
  const firstCode = value.charCodeAt(0);
  if (!isAsciiAlphaNumeric(firstCode)) {
    return false;
  }
  for (let i = 1; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (!isAsciiAlphaNumeric(code) && code !== 45 && code !== 95) {
      return false;
    }
  }
  return true;
}

function validateArea(raw) {
  if (typeof raw !== "string") {
    return null;
  }
  const trimmed = raw.trim();
  if (trimmed.length < 1 || trimmed.length > 100) {
    return null;
  }
  for (let i = 0; i < trimmed.length; i += 1) {
    const code = trimmed.charCodeAt(i);
    if (code <= 0x001f || (code >= 0x007f && code <= 0x009f)) {
      return null;
    }
    if (
      (code >= 0x202a && code <= 0x202e) ||
      (code >= 0x2066 && code <= 0x2069)
    ) {
      return null;
    }
    if (code >= 0xd800 && code <= 0xdbff) {
      if (i + 1 >= trimmed.length) {
        return null;
      }
      const nextCode = trimmed.charCodeAt(i + 1);
      if (nextCode < 0xdc00 || nextCode > 0xdfff) {
        return null;
      }
      i += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      return null;
    }
  }
  return trimmed;
}

function validateIntRange(raw, min, max) {
  if (typeof raw !== "number" || !Number.isInteger(raw)) {
    return null;
  }
  if (raw < min || raw > max) {
    return null;
  }
  return raw === 0 ? 0 : raw;
}

function validateBoolean(raw) {
  if (raw === true || raw === false) {
    return raw;
  }
  return null;
}

function hasExtraFields(row) {
  const keys = Object.keys(row);
  for (const key of keys) {
    if (
      key !== "id" &&
      key !== "area" &&
      key !== "paineisPrevistos" &&
      key !== "paineisDisponiveis" &&
      key !== "suportesDisponiveis" &&
      key !== "mapaConferido"
    ) {
      return true;
    }
  }
  return false;
}

function processRow(row, isDuplicate) {
  const validationIssues = [];

  const area = Object.hasOwn(row, "area") ? validateArea(row.area) : null;
  if (area === null) {
    validationIssues.push("area");
  }

  const paineisPrevistos = Object.hasOwn(row, "paineisPrevistos")
    ? validateIntRange(row.paineisPrevistos, 1, 1000000)
    : null;
  if (paineisPrevistos === null) {
    validationIssues.push("paineisPrevistos");
  }

  const paineisDisponiveis = Object.hasOwn(row, "paineisDisponiveis")
    ? validateIntRange(row.paineisDisponiveis, 0, 1000000)
    : null;
  if (paineisDisponiveis === null) {
    validationIssues.push("paineisDisponiveis");
  }

  const suportesDisponiveis = Object.hasOwn(row, "suportesDisponiveis")
    ? validateIntRange(row.suportesDisponiveis, 0, 1000000)
    : null;
  if (suportesDisponiveis === null) {
    validationIssues.push("suportesDisponiveis");
  }

  const mapaConferido = Object.hasOwn(row, "mapaConferido")
    ? validateBoolean(row.mapaConferido)
    : null;
  if (mapaConferido === null) {
    validationIssues.push("mapaConferido");
  }

  if (hasExtraFields(row)) {
    validationIssues.push("unexpectedFields");
  }

  if (isDuplicate) {
    return {
      id: row.id,
      area: area,
      paineisPrevistos: paineisPrevistos,
      paineisDisponiveis: paineisDisponiveis,
      suportesDisponiveis: suportesDisponiveis,
      mapaConferido: mapaConferido,
      status: "DUPLICATE",
      issues: "duplicateId"
    };
  }

  if (validationIssues.length > 0) {
    return {
      id: row.id,
      area: area,
      paineisPrevistos: paineisPrevistos,
      paineisDisponiveis: paineisDisponiveis,
      suportesDisponiveis: suportesDisponiveis,
      mapaConferido: mapaConferido,
      status: "INVALID",
      issues: validationIssues.join(", ")
    };
  }

  const conditionIssues = [];
  if (paineisDisponiveis < paineisPrevistos) {
    conditionIssues.push("paineisSuficientes");
  }
  if (suportesDisponiveis < paineisPrevistos) {
    conditionIssues.push("suportesSuficientes");
  }
  if (mapaConferido !== true) {
    conditionIssues.push("mapaEmOrdem");
  }

  const status = conditionIssues.length > 0 ? "PENDING" : "OK";
  return {
    id: row.id,
    area: area,
    paineisPrevistos: paineisPrevistos,
    paineisDisponiveis: paineisDisponiveis,
    suportesDisponiveis: suportesDisponiveis,
    mapaConferido: mapaConferido,
    status: status,
    issues: conditionIssues.join(", ")
  };
}

export function evaluate(input) {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return { error: "INVALID_INPUT" };
  }
  const topKeys = Object.keys(input);
  if (topKeys.length !== 1 || topKeys[0] !== "rows") {
    return { error: "INVALID_INPUT" };
  }
  const inputRows = input.rows;
  if (!Array.isArray(inputRows) || inputRows.length > 150) {
    return { error: "INVALID_INPUT" };
  }

  const idCounts = new Map();
  for (let i = 0; i < inputRows.length; i += 1) {
    const row = inputRows[i];
    if (row === null || typeof row !== "object" || Array.isArray(row)) {
      return { error: "INVALID_INPUT" };
    }
    if (!Object.hasOwn(row, "id") || !isValidId(row.id)) {
      return { error: "INVALID_INPUT" };
    }
    const lowerId = row.id.toLowerCase();
    const currentCount = idCounts.has(lowerId) ? idCounts.get(lowerId) : 0;
    idCounts.set(lowerId, currentCount + 1);
  }

  const outputRows = [];
  let validCount = 0;
  let pendingCount = 0;
  let invalidCount = 0;
  let duplicateCount = 0;
  let totalPaineisPrevistos = 0;
  let totalPaineisDisponiveis = 0;

  for (const row of inputRows) {
    const lowerId = row.id.toLowerCase();
    const isDuplicate = idCounts.get(lowerId) > 1;
    const evaluatedRow = processRow(row, isDuplicate);
    outputRows.push(evaluatedRow);

    if (evaluatedRow.status === "OK") {
      validCount += 1;
      totalPaineisPrevistos += evaluatedRow.paineisPrevistos;
      totalPaineisDisponiveis += evaluatedRow.paineisDisponiveis;
    } else if (evaluatedRow.status === "PENDING") {
      pendingCount += 1;
      totalPaineisPrevistos += evaluatedRow.paineisPrevistos;
      totalPaineisDisponiveis += evaluatedRow.paineisDisponiveis;
    } else if (evaluatedRow.status === "INVALID") {
      invalidCount += 1;
    } else if (evaluatedRow.status === "DUPLICATE") {
      duplicateCount += 1;
    }
  }

  return {
    rows: outputRows,
    summary: {
      valid: validCount,
      pending: pendingCount,
      invalid: invalidCount,
      duplicates: duplicateCount,
      totalPaineisPrevistos: totalPaineisPrevistos,
      totalPaineisDisponiveis: totalPaineisDisponiveis
    }
  };
}
