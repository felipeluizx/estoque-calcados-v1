-- Complementa passos de rota de separação com ação e locais de origem/destino
ALTER TABLE separation_route_steps ADD COLUMN action TEXT NOT NULL DEFAULT 'PICK';
ALTER TABLE separation_route_steps ADD COLUMN from_location TEXT;
ALTER TABLE separation_route_steps ADD COLUMN to_location TEXT;
