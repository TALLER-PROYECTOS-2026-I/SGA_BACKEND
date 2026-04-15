DROP INDEX "idx_audit_event_accion";--> statement-breakpoint
DROP INDEX "idx_audit_event_tabla_pk";--> statement-breakpoint
DROP INDEX "idx_silabo_estado";--> statement-breakpoint
DROP INDEX "uq_silabo_fuente";--> statement-breakpoint
DROP INDEX "idx_rev_hist_accion";--> statement-breakpoint
DROP INDEX "idx_rev_estado";--> statement-breakpoint
CREATE INDEX "idx_audit_event_accion" ON "audit_event" USING btree ("accion");--> statement-breakpoint
CREATE INDEX "idx_audit_event_tabla_pk" ON "audit_event" USING btree ("tabla","registro_pk");--> statement-breakpoint
CREATE INDEX "idx_silabo_estado" ON "silabo" USING btree ("estado_revision");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_silabo_fuente" ON "silabo_fuente" USING btree ("silabo_id" int4_ops,"titulo","anio");--> statement-breakpoint
CREATE INDEX "idx_rev_hist_accion" ON "silabo_revision_historial" USING btree ("accion");--> statement-breakpoint
CREATE INDEX "idx_rev_estado" ON "silabo_revision_seccion" USING btree ("estado");