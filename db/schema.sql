-- Esquema completo para una instalación nueva (ejecutar en phpMyAdmin).
-- Todas las fechas se guardan en UTC (la app escribe UTC_TIMESTAMP()).

CREATE TABLE IF NOT EXISTS campanas (
  id CHAR(36) PRIMARY KEY,
  nombre VARCHAR(255) NOT NULL,
  asunto VARCHAR(500) NOT NULL,
  creado_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- estado: pendiente (en cola) | enviando | enviado | error | omitido | rebotado | cancelado
CREATE TABLE IF NOT EXISTS emails (
  id CHAR(36) PRIMARY KEY,
  destinatario VARCHAR(255) NOT NULL,
  asunto VARCHAR(500) NOT NULL,
  cuerpo LONGTEXT NOT NULL,
  enviado_at DATETIME NULL DEFAULT NULL,
  user_id VARCHAR(255) NOT NULL,
  campana_id CHAR(36) NULL,
  estado VARCHAR(16) NOT NULL DEFAULT 'enviado',
  error_envio VARCHAR(500) NULL,
  creado_at DATETIME NULL,
  lote CHAR(36) NULL,
  con_baja TINYINT(1) NOT NULL DEFAULT 0,
  resend_id VARCHAR(64) NULL,
  seguimiento_id INT NULL,
  seguimiento_hecho TINYINT(1) NOT NULL DEFAULT 0,
  seguimiento_de CHAR(36) NULL,
  programado_at DATETIME NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_emails_estado ON emails(estado, creado_at);
CREATE INDEX idx_emails_resend_id ON emails(resend_id);
CREATE INDEX idx_emails_seguimiento ON emails(seguimiento_id, seguimiento_hecho);

CREATE TABLE IF NOT EXISTS aperturas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email_id CHAR(36) NOT NULL,
  abierto_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ip VARCHAR(64),
  user_agent VARCHAR(500),
  sospechosa TINYINT(1) NOT NULL DEFAULT 0,
  FOREIGN KEY (email_id) REFERENCES emails(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS clics (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email_id CHAR(36) NOT NULL,
  url_destino VARCHAR(2048) NOT NULL,
  click_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ip VARCHAR(64),
  user_agent VARCHAR(500),
  FOREIGN KEY (email_id) REFERENCES emails(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_aperturas_email_id ON aperturas(email_id);
CREATE INDEX idx_clics_email_id ON clics(email_id);

CREATE TABLE IF NOT EXISTS plantillas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(255) NOT NULL,
  asunto VARCHAR(500) NOT NULL,
  cuerpo LONGTEXT NOT NULL,
  creado_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS contactos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  nombre VARCHAR(255) NOT NULL DEFAULT '',
  empresa VARCHAR(255) NOT NULL DEFAULT '',
  creado_at DATETIME NOT NULL,
  -- estado: activo | baja | rebotado | queja
  estado VARCHAR(16) NOT NULL DEFAULT 'activo',
  estado_at DATETIME NULL,
  estado_motivo VARCHAR(255) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Recordatorio automático: condicion = sin_apertura | sin_clic
CREATE TABLE IF NOT EXISTS seguimientos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  condicion VARCHAR(16) NOT NULL,
  dias INT NOT NULL,
  asunto VARCHAR(500) NOT NULL DEFAULT '',
  cuerpo LONGTEXT NOT NULL,
  creado_at DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS etiquetas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(60) NOT NULL UNIQUE,
  creado_at DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS contacto_etiquetas (
  contacto_id INT NOT NULL,
  etiqueta_id INT NOT NULL,
  PRIMARY KEY (contacto_id, etiqueta_id),
  FOREIGN KEY (contacto_id) REFERENCES contactos(id) ON DELETE CASCADE,
  FOREIGN KEY (etiqueta_id) REFERENCES etiquetas(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Ajustes editables desde el panel (remitente, responder a).
CREATE TABLE IF NOT EXISTS ajustes (
  clave VARCHAR(64) PRIMARY KEY,
  valor TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
