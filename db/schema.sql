-- Esquema completo para una instalación nueva (ejecutar en phpMyAdmin).
-- Todas las fechas se guardan en UTC (la app escribe UTC_TIMESTAMP()).

CREATE TABLE IF NOT EXISTS campanas (
  id CHAR(36) PRIMARY KEY,
  nombre VARCHAR(255) NOT NULL,
  asunto VARCHAR(500) NOT NULL,
  creado_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- estado: 'pendiente' (en cola) | 'enviando' | 'enviado' | 'error'
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
  lote CHAR(36) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_emails_estado ON emails(estado, creado_at);

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
  creado_at DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
