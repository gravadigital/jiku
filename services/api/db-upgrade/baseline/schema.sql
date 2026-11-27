-- Baseline schema: the database as it was after the last migration listed in
-- applied-migrations.txt (20260729_01), taken with pg_dump --schema-only --no-owner
-- --no-privileges. The migrations in ../migrations/ never built the schema from an empty
-- database: they started from an existing one. ../baseline.js applies this file only on an
-- empty database, so the migrations that follow have the schema they expect.
-- Never edit it: a schema change is a new migration.
--
-- PostgreSQL database dump
--

-- Dumped from database version 15.4
-- Dumped by pg_dump version 15.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: attachment_entity_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.attachment_entity_type AS ENUM (
    'objective',
    'project',
    'stage',
    'comment',
    'comment_draft',
    'objective_draft',
    'requirement_draft',
    'requirement',
    'objective_comment',
    'requirement_comment',
    'objective_comment_draft',
    'requirement_comment_draft'
);


--
-- Name: enum_objective_activity_type_of_activity; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_objective_activity_type_of_activity AS ENUM (
    'title',
    'state',
    'area',
    'comment',
    'description',
    'person',
    'priority',
    'estimatedFinishDate',
    'stageId'
);


--
-- Name: enum_objective_activity_visibility_level; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_objective_activity_visibility_level AS ENUM (
    'public',
    'internal'
);


--
-- Name: enum_objective_changes_type_of_change; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_objective_changes_type_of_change AS ENUM (
    'state',
    'area',
    'title',
    'person',
    'priority',
    'finish_date'
);


--
-- Name: enum_objectives_area; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_objectives_area AS ENUM (
    'diseño',
    'desarrollo',
    'gestion',
    'investigacion'
);


--
-- Name: enum_objectives_state; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_objectives_state AS ENUM (
    'backlog',
    'activo',
    'finalizado',
    'cancelado',
    'en_revision'
);


--
-- Name: enum_objectives_visibility_level; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_objectives_visibility_level AS ENUM (
    'public',
    'internal'
);


--
-- Name: enum_projects_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_projects_status AS ENUM (
    'analisis',
    'activo',
    'inactivo',
    'finalizado',
    'cancelado'
);


--
-- Name: enum_projects_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_projects_type AS ENUM (
    'comercial',
    'interno',
    'investigacion',
    'propuesta'
);


--
-- Name: enum_requirement_activity_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_requirement_activity_type AS ENUM (
    'state',
    'comment',
    'type',
    'priority',
    'estimatedFinishDate',
    'tag',
    'resolution',
    'title',
    'description'
);


--
-- Name: enum_requirement_activity_type_of_activity; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_requirement_activity_type_of_activity AS ENUM (
    'state',
    'comment',
    'type',
    'priority',
    'closeDate',
    'project',
    'tag'
);


--
-- Name: enum_requirement_activity_visibility_level; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_requirement_activity_visibility_level AS ENUM (
    'public',
    'internal'
);


--
-- Name: enum_requirement_priority; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_requirement_priority AS ENUM (
    'sin_prioridad',
    'baja',
    'media',
    'alta',
    'urgente'
);


--
-- Name: enum_requirement_resolution; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_requirement_resolution AS ENUM (
    'error_interno',
    'fuera_de_alcance',
    'error_externo',
    'discutible',
    'otro'
);


--
-- Name: enum_requirement_state; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_requirement_state AS ENUM (
    'analisis',
    'planificacion',
    'desarrollo',
    'revision',
    'resuelto',
    'cancelado',
    'en_cola'
);


--
-- Name: enum_requirement_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_requirement_type AS ENUM (
    'funcionalidad',
    'mejora',
    'incidencia',
    'otro'
);


--
-- Name: enum_requirements_priority; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_requirements_priority AS ENUM (
    'baja',
    'media',
    'alta',
    'urgente'
);


--
-- Name: enum_requirements_state; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_requirements_state AS ENUM (
    'solicitud',
    'en_revision',
    'confirmado',
    'programado',
    'en_progreso',
    'finalizado',
    'no_aprobado'
);


--
-- Name: enum_requirements_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_requirements_type AS ENUM (
    'funcional',
    'mejora',
    'bug',
    'soporte'
);


--
-- Name: enum_requirements_visibility_level; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_requirements_visibility_level AS ENUM (
    'public',
    'internal'
);


--
-- Name: enum_stages_state; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_stages_state AS ENUM (
    'active',
    'finished'
);


--
-- Name: enum_stages_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_stages_type AS ENUM (
    'support',
    'scope'
);


--
-- Name: enum_unworked_reason; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_unworked_reason AS ENUM (
    'tramite',
    'corte_servicios',
    'vacaciones',
    'dia_no_laborable',
    'personal',
    'medico',
    'estudio',
    'enfermedad',
    'otro'
);


--
-- Name: enum_unworked_times_reason; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_unworked_times_reason AS ENUM (
    'tramite',
    'corte_servicios',
    'vacaciones',
    'dia_no_laborable',
    'personal',
    'medico',
    'estudio',
    'enfermedad',
    'otro'
);


--
-- Name: retention_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.retention_status AS ENUM (
    'active',
    'scheduled_for_deletion',
    'deleted'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: attachments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.attachments (
    id integer NOT NULL,
    entity_type public.attachment_entity_type NOT NULL,
    entity_id integer,
    file_name character varying(255) NOT NULL,
    file_size integer NOT NULL,
    mime_type character varying(100) NOT NULL,
    storage_key character varying(500) NOT NULL,
    storage_bucket character varying(100) NOT NULL,
    storage_region character varying(50) NOT NULL,
    uploaded_by character varying(100) NOT NULL,
    description text,
    checksum character varying(64),
    retention_status public.retention_status DEFAULT 'active'::public.retention_status NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by character varying(100),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT check_attachments_active_status CHECK ((((deleted_at IS NULL) AND (retention_status = 'active'::public.retention_status)) OR (deleted_at IS NOT NULL)))
);


--
-- Name: attachments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.attachments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: attachments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.attachments_id_seq OWNED BY public.attachments.id;


--
-- Name: clients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clients (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    description text
);


--
-- Name: clients_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.clients_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: clients_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.clients_id_seq OWNED BY public.clients.id;


--
-- Name: external_integration_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.external_integration_config (
    id integer NOT NULL,
    client_id integer NOT NULL,
    system_type character varying(50) NOT NULL,
    base_url character varying(500) NOT NULL,
    auth_email character varying(255) NOT NULL,
    auth_token_encrypted text NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    config jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: external_integration_config_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.external_integration_config_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: external_integration_config_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.external_integration_config_id_seq OWNED BY public.external_integration_config.id;


--
-- Name: external_project; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.external_project (
    id integer NOT NULL,
    integration_id integer NOT NULL,
    external_project_id character varying(255) NOT NULL,
    external_project_key character varying(100) NOT NULL,
    name character varying(500) NOT NULL,
    local_project_id integer,
    config jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    prefix character varying(50)
);


--
-- Name: COLUMN external_project.prefix; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.external_project.prefix IS 'Optional prefix filter for Jira issue titles. NULL = sync all issues. Example: [VIS], [RIMS]';


--
-- Name: external_project_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.external_project_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: external_project_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.external_project_id_seq OWNED BY public.external_project.id;


--
-- Name: external_sync_event; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.external_sync_event (
    id integer NOT NULL,
    integration_id integer NOT NULL,
    external_project_id integer,
    started_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    finished_at timestamp with time zone,
    status character varying(20) NOT NULL,
    issues_created integer DEFAULT 0 NOT NULL,
    issues_updated integer DEFAULT 0 NOT NULL,
    issues_failed integer DEFAULT 0 NOT NULL,
    errors jsonb,
    metadata jsonb
);


--
-- Name: external_sync_event_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.external_sync_event_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: external_sync_event_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.external_sync_event_id_seq OWNED BY public.external_sync_event.id;


--
-- Name: inbound_mail_threads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inbound_mail_threads (
    id integer NOT NULL,
    requirement_id integer NOT NULL,
    message_id character varying(500) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: inbound_mail_threads_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.inbound_mail_threads_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: inbound_mail_threads_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.inbound_mail_threads_id_seq OWNED BY public.inbound_mail_threads.id;


--
-- Name: objective_activity; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.objective_activity (
    id integer NOT NULL,
    type_of_activity public.enum_objective_activity_type_of_activity,
    previous_value text,
    new_value text,
    objective_id integer NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    changed_by character varying(255) NOT NULL,
    external_reference_url text,
    external_user_name character varying(255),
    external_user_id character varying(128),
    visibility_level public.enum_objective_activity_visibility_level DEFAULT 'internal'::public.enum_objective_activity_visibility_level NOT NULL
);


--
-- Name: objective_changes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.objective_changes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: objective_changes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.objective_changes_id_seq OWNED BY public.objective_activity.id;


--
-- Name: objective_mail_threads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.objective_mail_threads (
    id integer NOT NULL,
    objective_id integer NOT NULL,
    message_id character varying(500) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    mattermost_post_id character varying(100)
);


--
-- Name: objective_mail_threads_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.objective_mail_threads_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: objective_mail_threads_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.objective_mail_threads_id_seq OWNED BY public.objective_mail_threads.id;


--
-- Name: objectives; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.objectives (
    id integer NOT NULL,
    title character varying(255) NOT NULL,
    estimated_finish_date character varying(255),
    state public.enum_objectives_state,
    priority integer NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    project_id integer,
    area public.enum_objectives_area NOT NULL,
    created_by character varying(255) NOT NULL,
    description text,
    finished_at timestamp with time zone,
    visibility_level public.enum_objectives_visibility_level DEFAULT 'public'::public.enum_objectives_visibility_level NOT NULL,
    stage_id integer,
    external_project_id integer,
    external_issue_id character varying(255),
    external_issue_key character varying(100),
    external_url text,
    external_raw_data jsonb,
    last_synced_at timestamp with time zone,
    requirement_id integer
);


--
-- Name: objectives_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.objectives_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: objectives_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.objectives_id_seq OWNED BY public.objectives.id;


--
-- Name: objectives_subscriptors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.objectives_subscriptors (
    id integer NOT NULL,
    objective_id integer NOT NULL,
    user_id character varying(100) NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


--
-- Name: objectives_subscriptors_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.objectives_subscriptors_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: objectives_subscriptors_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.objectives_subscriptors_id_seq OWNED BY public.objectives_subscriptors.id;


--
-- Name: origins; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.origins (
    id integer NOT NULL,
    reference integer,
    name character varying(255),
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: origins_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.origins_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: origins_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.origins_id_seq OWNED BY public.origins.id;


--
-- Name: people; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.people (
    id integer NOT NULL,
    first_name character varying(255) NOT NULL,
    last_name character varying(255) NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    init_date timestamp with time zone NOT NULL,
    end_date timestamp with time zone,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    user_id character varying(100),
    must_charge_worked_time boolean DEFAULT true NOT NULL
);


--
-- Name: people_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.people_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: people_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.people_id_seq OWNED BY public.people.id;


--
-- Name: people_objectives; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.people_objectives (
    is_leader boolean,
    active boolean,
    person_id integer NOT NULL,
    objective_id integer NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: people_requirements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.people_requirements (
    person_id integer NOT NULL,
    requirement_id integer NOT NULL,
    is_leader boolean,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: project_status_updates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_status_updates (
    id integer NOT NULL,
    status character varying(255) NOT NULL,
    update_date timestamp with time zone NOT NULL,
    comment character varying(255) NOT NULL,
    project_id integer,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: project_status_updates_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.project_status_updates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: project_status_updates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.project_status_updates_id_seq OWNED BY public.project_status_updates.id;


--
-- Name: projects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.projects (
    id integer NOT NULL,
    code character varying(255),
    name character varying(255),
    type public.enum_projects_type NOT NULL,
    description text,
    status public.enum_projects_status,
    init_date timestamp with time zone NOT NULL,
    end_date timestamp with time zone,
    priority integer DEFAULT 0,
    origin_id integer,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    created_by character varying(255) NOT NULL,
    client_id integer,
    key_value_pairs json,
    ticket_slug character varying(255)
);


--
-- Name: projects_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.projects_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: projects_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.projects_id_seq OWNED BY public.projects.id;


--
-- Name: projects_objectives; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.projects_objectives (
    project_id integer NOT NULL,
    objective_id integer NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: projects_persons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.projects_persons (
    project_id integer NOT NULL,
    person_id integer NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: requirement_activity; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.requirement_activity (
    id integer NOT NULL,
    type_of_activity public.enum_requirement_activity_type NOT NULL,
    previous_value text NOT NULL,
    new_value text NOT NULL,
    visibility_level public.enum_requirement_activity_visibility_level DEFAULT 'internal'::public.enum_requirement_activity_visibility_level NOT NULL,
    requirement_id integer NOT NULL,
    changed_by character varying(100) NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: requirement_activity_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.requirement_activity_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: requirement_activity_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.requirement_activity_id_seq OWNED BY public.requirement_activity.id;


--
-- Name: requirement_mail_threads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.requirement_mail_threads (
    id integer NOT NULL,
    requirement_id integer NOT NULL,
    message_id character varying(500) NOT NULL,
    mattermost_post_id character varying(100),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: requirement_mail_threads_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.requirement_mail_threads_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: requirement_mail_threads_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.requirement_mail_threads_id_seq OWNED BY public.requirement_mail_threads.id;


--
-- Name: requirement_subscriptors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.requirement_subscriptors (
    id integer NOT NULL,
    requirement_id integer NOT NULL,
    user_id character varying(100) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: requirement_subscriptors_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.requirement_subscriptors_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: requirement_subscriptors_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.requirement_subscriptors_id_seq OWNED BY public.requirement_subscriptors.id;


--
-- Name: requirements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.requirements (
    id integer NOT NULL,
    title character varying(255) NOT NULL,
    description text NOT NULL,
    type public.enum_requirement_type,
    priority public.enum_requirement_priority DEFAULT 'sin_prioridad'::public.enum_requirement_priority NOT NULL,
    state public.enum_requirement_state NOT NULL,
    estimated_finish_date date,
    tags jsonb,
    created_by character varying(100) NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    project_id integer NOT NULL,
    scheduled_at timestamp with time zone,
    in_progress_at timestamp with time zone,
    in_review_at timestamp with time zone,
    finished_at timestamp with time zone,
    visibility_level public.enum_requirements_visibility_level DEFAULT 'public'::public.enum_requirements_visibility_level NOT NULL,
    resolution_conclusion text,
    scope text,
    technical_solution text,
    acceptance_criteria text,
    resolution_type public.enum_requirement_resolution,
    resolution_comment text
);


--
-- Name: requirements_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.requirements_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: requirements_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.requirements_id_seq OWNED BY public.requirements.id;


--
-- Name: resources; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.resources (
    id integer NOT NULL,
    key character varying(255),
    value character varying(255),
    project_id integer,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: resources_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.resources_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: resources_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.resources_id_seq OWNED BY public.resources.id;


--
-- Name: sequelize_meta; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sequelize_meta (
    name character varying(255) NOT NULL
);


--
-- Name: stages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stages (
    id integer NOT NULL,
    title character varying(255) NOT NULL,
    init_date timestamp with time zone NOT NULL,
    state public.enum_stages_state NOT NULL,
    type public.enum_stages_type,
    estimated_completion_date timestamp with time zone,
    scope text,
    estimated_hours integer,
    project_id integer NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    is_current_active boolean DEFAULT false NOT NULL
);


--
-- Name: stages_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.stages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: stages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.stages_id_seq OWNED BY public.stages.id;


--
-- Name: system_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_settings (
    id integer NOT NULL,
    key character varying(255) NOT NULL,
    value character varying(255) NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: system_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.system_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: system_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.system_settings_id_seq OWNED BY public.system_settings.id;


--
-- Name: unworked_times; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.unworked_times (
    id integer NOT NULL,
    date date NOT NULL,
    minutes integer NOT NULL,
    reason public.enum_unworked_times_reason NOT NULL,
    person_id integer NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: unworked_times_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.unworked_times_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: unworked_times_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.unworked_times_id_seq OWNED BY public.unworked_times.id;


--
-- Name: user_project_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_project_permissions (
    id integer NOT NULL,
    user_id character varying(100) NOT NULL,
    project_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: user_project_permissions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_project_permissions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: user_project_permissions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_project_permissions_id_seq OWNED BY public.user_project_permissions.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id character varying(100) NOT NULL,
    name character varying(255) NOT NULL,
    username character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


--
-- Name: week_assigned_times; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.week_assigned_times (
    id integer NOT NULL,
    date_from timestamp with time zone,
    date_to timestamp with time zone,
    internal boolean,
    minutes integer,
    project_id integer,
    person_id integer,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: week_assigned_times_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.week_assigned_times_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: week_assigned_times_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.week_assigned_times_id_seq OWNED BY public.week_assigned_times.id;


--
-- Name: worked_times; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.worked_times (
    id integer NOT NULL,
    date timestamp with time zone,
    minutes integer,
    project_id integer,
    person_id integer,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    objective_id integer,
    stage_id integer,
    requirement_id integer
);


--
-- Name: worked_times_absence_migration_backup; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.worked_times_absence_migration_backup (
    migration_tag text NOT NULL,
    backed_up_at timestamp with time zone DEFAULT now() NOT NULL,
    worked_time_id integer NOT NULL,
    date timestamp with time zone NOT NULL,
    minutes integer NOT NULL,
    project_id integer NOT NULL,
    person_id integer NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    objective_id integer
);


--
-- Name: worked_times_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.worked_times_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: worked_times_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.worked_times_id_seq OWNED BY public.worked_times.id;


--
-- Name: attachments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attachments ALTER COLUMN id SET DEFAULT nextval('public.attachments_id_seq'::regclass);


--
-- Name: clients id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients ALTER COLUMN id SET DEFAULT nextval('public.clients_id_seq'::regclass);


--
-- Name: external_integration_config id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.external_integration_config ALTER COLUMN id SET DEFAULT nextval('public.external_integration_config_id_seq'::regclass);


--
-- Name: external_project id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.external_project ALTER COLUMN id SET DEFAULT nextval('public.external_project_id_seq'::regclass);


--
-- Name: external_sync_event id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.external_sync_event ALTER COLUMN id SET DEFAULT nextval('public.external_sync_event_id_seq'::regclass);


--
-- Name: inbound_mail_threads id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inbound_mail_threads ALTER COLUMN id SET DEFAULT nextval('public.inbound_mail_threads_id_seq'::regclass);


--
-- Name: objective_activity id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.objective_activity ALTER COLUMN id SET DEFAULT nextval('public.objective_changes_id_seq'::regclass);


--
-- Name: objective_mail_threads id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.objective_mail_threads ALTER COLUMN id SET DEFAULT nextval('public.objective_mail_threads_id_seq'::regclass);


--
-- Name: objectives id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.objectives ALTER COLUMN id SET DEFAULT nextval('public.objectives_id_seq'::regclass);


--
-- Name: objectives_subscriptors id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.objectives_subscriptors ALTER COLUMN id SET DEFAULT nextval('public.objectives_subscriptors_id_seq'::regclass);


--
-- Name: origins id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.origins ALTER COLUMN id SET DEFAULT nextval('public.origins_id_seq'::regclass);


--
-- Name: people id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.people ALTER COLUMN id SET DEFAULT nextval('public.people_id_seq'::regclass);


--
-- Name: project_status_updates id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_status_updates ALTER COLUMN id SET DEFAULT nextval('public.project_status_updates_id_seq'::regclass);


--
-- Name: projects id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects ALTER COLUMN id SET DEFAULT nextval('public.projects_id_seq'::regclass);


--
-- Name: requirement_activity id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.requirement_activity ALTER COLUMN id SET DEFAULT nextval('public.requirement_activity_id_seq'::regclass);


--
-- Name: requirement_mail_threads id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.requirement_mail_threads ALTER COLUMN id SET DEFAULT nextval('public.requirement_mail_threads_id_seq'::regclass);


--
-- Name: requirement_subscriptors id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.requirement_subscriptors ALTER COLUMN id SET DEFAULT nextval('public.requirement_subscriptors_id_seq'::regclass);


--
-- Name: requirements id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.requirements ALTER COLUMN id SET DEFAULT nextval('public.requirements_id_seq'::regclass);


--
-- Name: resources id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resources ALTER COLUMN id SET DEFAULT nextval('public.resources_id_seq'::regclass);


--
-- Name: stages id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stages ALTER COLUMN id SET DEFAULT nextval('public.stages_id_seq'::regclass);


--
-- Name: system_settings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_settings ALTER COLUMN id SET DEFAULT nextval('public.system_settings_id_seq'::regclass);


--
-- Name: unworked_times id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unworked_times ALTER COLUMN id SET DEFAULT nextval('public.unworked_times_id_seq'::regclass);


--
-- Name: user_project_permissions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_project_permissions ALTER COLUMN id SET DEFAULT nextval('public.user_project_permissions_id_seq'::regclass);


--
-- Name: week_assigned_times id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.week_assigned_times ALTER COLUMN id SET DEFAULT nextval('public.week_assigned_times_id_seq'::regclass);


--
-- Name: worked_times id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.worked_times ALTER COLUMN id SET DEFAULT nextval('public.worked_times_id_seq'::regclass);


--
-- Name: attachments attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attachments
    ADD CONSTRAINT attachments_pkey PRIMARY KEY (id);


--
-- Name: attachments attachments_storage_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attachments
    ADD CONSTRAINT attachments_storage_key_key UNIQUE (storage_key);


--
-- Name: clients clients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_pkey PRIMARY KEY (id);


--
-- Name: external_integration_config external_integration_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.external_integration_config
    ADD CONSTRAINT external_integration_config_pkey PRIMARY KEY (id);


--
-- Name: external_project external_project_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.external_project
    ADD CONSTRAINT external_project_pkey PRIMARY KEY (id);


--
-- Name: external_sync_event external_sync_event_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.external_sync_event
    ADD CONSTRAINT external_sync_event_pkey PRIMARY KEY (id);


--
-- Name: inbound_mail_threads inbound_mail_threads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inbound_mail_threads
    ADD CONSTRAINT inbound_mail_threads_pkey PRIMARY KEY (id);


--
-- Name: objective_activity objective_changes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.objective_activity
    ADD CONSTRAINT objective_changes_pkey PRIMARY KEY (id);


--
-- Name: objective_mail_threads objective_mail_threads_objective_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.objective_mail_threads
    ADD CONSTRAINT objective_mail_threads_objective_id_key UNIQUE (objective_id);


--
-- Name: objective_mail_threads objective_mail_threads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.objective_mail_threads
    ADD CONSTRAINT objective_mail_threads_pkey PRIMARY KEY (id);


--
-- Name: objectives objectives_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.objectives
    ADD CONSTRAINT objectives_pkey PRIMARY KEY (id);


--
-- Name: objectives_subscriptors objectives_subscriptors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.objectives_subscriptors
    ADD CONSTRAINT objectives_subscriptors_pkey PRIMARY KEY (id);


--
-- Name: origins origins_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.origins
    ADD CONSTRAINT origins_pkey PRIMARY KEY (id);


--
-- Name: people_objectives people_objectives_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.people_objectives
    ADD CONSTRAINT people_objectives_pkey PRIMARY KEY (person_id, objective_id);


--
-- Name: people people_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.people
    ADD CONSTRAINT people_pkey PRIMARY KEY (id);


--
-- Name: people_requirements people_requirements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.people_requirements
    ADD CONSTRAINT people_requirements_pkey PRIMARY KEY (person_id, requirement_id);


--
-- Name: project_status_updates project_status_updates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_status_updates
    ADD CONSTRAINT project_status_updates_pkey PRIMARY KEY (id);


--
-- Name: projects_objectives projects_objectives_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects_objectives
    ADD CONSTRAINT projects_objectives_pkey PRIMARY KEY (project_id, objective_id);


--
-- Name: projects_persons projects_persons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects_persons
    ADD CONSTRAINT projects_persons_pkey PRIMARY KEY (project_id, person_id);


--
-- Name: projects projects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (id);


--
-- Name: requirement_activity requirement_activity_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.requirement_activity
    ADD CONSTRAINT requirement_activity_pkey PRIMARY KEY (id);


--
-- Name: requirement_mail_threads requirement_mail_threads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.requirement_mail_threads
    ADD CONSTRAINT requirement_mail_threads_pkey PRIMARY KEY (id);


--
-- Name: requirement_mail_threads requirement_mail_threads_requirement_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.requirement_mail_threads
    ADD CONSTRAINT requirement_mail_threads_requirement_id_key UNIQUE (requirement_id);


--
-- Name: requirement_subscriptors requirement_subscriptors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.requirement_subscriptors
    ADD CONSTRAINT requirement_subscriptors_pkey PRIMARY KEY (id);


--
-- Name: requirements requirements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.requirements
    ADD CONSTRAINT requirements_pkey PRIMARY KEY (id);


--
-- Name: resources resources_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resources
    ADD CONSTRAINT resources_pkey PRIMARY KEY (id);


--
-- Name: sequelize_meta sequelize_meta_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sequelize_meta
    ADD CONSTRAINT sequelize_meta_pkey PRIMARY KEY (name);


--
-- Name: stages stages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stages
    ADD CONSTRAINT stages_pkey PRIMARY KEY (id);


--
-- Name: system_settings system_settings_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_key_key UNIQUE (key);


--
-- Name: system_settings system_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_pkey PRIMARY KEY (id);


--
-- Name: unworked_times unworked_times_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unworked_times
    ADD CONSTRAINT unworked_times_pkey PRIMARY KEY (id);


--
-- Name: user_project_permissions user_project_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_project_permissions
    ADD CONSTRAINT user_project_permissions_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: week_assigned_times week_assigned_times_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.week_assigned_times
    ADD CONSTRAINT week_assigned_times_pkey PRIMARY KEY (id);


--
-- Name: worked_times_absence_migration_backup worked_times_absence_migration_backup_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.worked_times_absence_migration_backup
    ADD CONSTRAINT worked_times_absence_migration_backup_pkey PRIMARY KEY (migration_tag, worked_time_id);


--
-- Name: worked_times worked_times_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.worked_times
    ADD CONSTRAINT worked_times_pkey PRIMARY KEY (id);


--
-- Name: idx_attachments_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attachments_entity ON public.attachments USING btree (entity_type, entity_id, deleted_at);


--
-- Name: idx_attachments_uploader; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attachments_uploader ON public.attachments USING btree (uploaded_by, deleted_at);


--
-- Name: idx_external_project_integration_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_external_project_integration_project ON public.external_project USING btree (integration_id, external_project_id);


--
-- Name: idx_external_project_prefix; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_external_project_prefix ON public.external_project USING btree (prefix) WHERE (prefix IS NOT NULL);


--
-- Name: idx_external_project_unique_prefix; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_external_project_unique_prefix ON public.external_project USING btree (integration_id, external_project_id, prefix);


--
-- Name: idx_inbound_mail_threads_requirement_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inbound_mail_threads_requirement_id ON public.inbound_mail_threads USING btree (requirement_id);


--
-- Name: idx_objectives_requirement_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_objectives_requirement_id ON public.objectives USING btree (requirement_id);


--
-- Name: idx_people_requirements_requirement_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_people_requirements_requirement_id ON public.people_requirements USING btree (requirement_id);


--
-- Name: idx_projects_client_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_projects_client_id ON public.projects USING btree (client_id);


--
-- Name: idx_requirement_activity_requirement_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_requirement_activity_requirement_id ON public.requirement_activity USING btree (requirement_id);


--
-- Name: idx_requirement_subscriptors_requirement_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_requirement_subscriptors_requirement_id ON public.requirement_subscriptors USING btree (requirement_id);


--
-- Name: idx_requirement_subscriptors_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_requirement_subscriptors_unique ON public.requirement_subscriptors USING btree (requirement_id, user_id);


--
-- Name: idx_requirement_subscriptors_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_requirement_subscriptors_user_id ON public.requirement_subscriptors USING btree (user_id);


--
-- Name: idx_requirements_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_requirements_created_by ON public.requirements USING btree (created_by);


--
-- Name: idx_requirements_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_requirements_project_id ON public.requirements USING btree (project_id);


--
-- Name: idx_requirements_state; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_requirements_state ON public.requirements USING btree (state);


--
-- Name: idx_requirements_tags; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_requirements_tags ON public.requirements USING gin (tags);


--
-- Name: idx_unworked_person_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_unworked_person_date ON public.unworked_times USING btree (person_id, date);


--
-- Name: idx_worked_times_requirement_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_worked_times_requirement_id ON public.worked_times USING btree (requirement_id);


--
-- Name: uk_inbound_mail_threads_message_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uk_inbound_mail_threads_message_id ON public.inbound_mail_threads USING btree (message_id);


--
-- Name: uk_objective_activity_external_comment; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uk_objective_activity_external_comment ON public.objective_activity USING btree (external_reference_url) WHERE ((type_of_activity = 'comment'::public.enum_objective_activity_type_of_activity) AND (external_reference_url IS NOT NULL));


--
-- Name: INDEX uk_objective_activity_external_comment; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.uk_objective_activity_external_comment IS 'Ensures each Jira comment (external_reference_url) is synced only once. Partial index for comment activities with non-null URLs.';


--
-- Name: uk_projects_ticket_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uk_projects_ticket_slug ON public.projects USING btree (ticket_slug) WHERE (ticket_slug IS NOT NULL);


--
-- Name: uk_user_project_permissions; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uk_user_project_permissions ON public.user_project_permissions USING btree (user_id, project_id);


--
-- Name: attachments attachments_deleted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attachments
    ADD CONSTRAINT attachments_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: attachments attachments_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attachments
    ADD CONSTRAINT attachments_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: external_integration_config external_integration_config_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.external_integration_config
    ADD CONSTRAINT external_integration_config_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: external_project external_project_integration_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.external_project
    ADD CONSTRAINT external_project_integration_id_fkey FOREIGN KEY (integration_id) REFERENCES public.external_integration_config(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: external_project external_project_local_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.external_project
    ADD CONSTRAINT external_project_local_project_id_fkey FOREIGN KEY (local_project_id) REFERENCES public.projects(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: external_sync_event external_sync_event_external_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.external_sync_event
    ADD CONSTRAINT external_sync_event_external_project_id_fkey FOREIGN KEY (external_project_id) REFERENCES public.external_project(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: external_sync_event external_sync_event_integration_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.external_sync_event
    ADD CONSTRAINT external_sync_event_integration_id_fkey FOREIGN KEY (integration_id) REFERENCES public.external_integration_config(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: inbound_mail_threads inbound_mail_threads_requirement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inbound_mail_threads
    ADD CONSTRAINT inbound_mail_threads_requirement_id_fkey FOREIGN KEY (requirement_id) REFERENCES public.requirements(id) ON DELETE CASCADE;


--
-- Name: objective_activity objective_changes_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.objective_activity
    ADD CONSTRAINT objective_changes_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: objective_activity objective_changes_changed_by_fkey1; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.objective_activity
    ADD CONSTRAINT objective_changes_changed_by_fkey1 FOREIGN KEY (changed_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: objective_mail_threads objective_mail_threads_objective_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.objective_mail_threads
    ADD CONSTRAINT objective_mail_threads_objective_id_fkey FOREIGN KEY (objective_id) REFERENCES public.objectives(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: objectives objectives_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.objectives
    ADD CONSTRAINT objectives_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: objectives objectives_created_by_fkey1; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.objectives
    ADD CONSTRAINT objectives_created_by_fkey1 FOREIGN KEY (created_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: objectives objectives_external_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.objectives
    ADD CONSTRAINT objectives_external_project_id_fkey FOREIGN KEY (external_project_id) REFERENCES public.external_project(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: objectives objectives_requirement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.objectives
    ADD CONSTRAINT objectives_requirement_id_fkey FOREIGN KEY (requirement_id) REFERENCES public.requirements(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: objectives objectives_stage_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.objectives
    ADD CONSTRAINT objectives_stage_id_fkey FOREIGN KEY (stage_id) REFERENCES public.stages(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: objectives_subscriptors objectives_subscriptors_objective_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.objectives_subscriptors
    ADD CONSTRAINT objectives_subscriptors_objective_id_fkey FOREIGN KEY (objective_id) REFERENCES public.objectives(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: objectives_subscriptors objectives_subscriptors_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.objectives_subscriptors
    ADD CONSTRAINT objectives_subscriptors_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: people_objectives people_objectives_objective_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.people_objectives
    ADD CONSTRAINT people_objectives_objective_id_fkey FOREIGN KEY (objective_id) REFERENCES public.objectives(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: people_objectives people_objectives_person_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.people_objectives
    ADD CONSTRAINT people_objectives_person_id_fkey FOREIGN KEY (person_id) REFERENCES public.people(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: people_requirements people_requirements_person_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.people_requirements
    ADD CONSTRAINT people_requirements_person_id_fkey FOREIGN KEY (person_id) REFERENCES public.people(id);


--
-- Name: people_requirements people_requirements_requirement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.people_requirements
    ADD CONSTRAINT people_requirements_requirement_id_fkey FOREIGN KEY (requirement_id) REFERENCES public.requirements(id);


--
-- Name: people people_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.people
    ADD CONSTRAINT people_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: project_status_updates project_status_updates_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_status_updates
    ADD CONSTRAINT project_status_updates_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON UPDATE CASCADE;


--
-- Name: projects projects_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: projects projects_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: projects projects_created_by_fkey1; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_created_by_fkey1 FOREIGN KEY (created_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: projects_objectives projects_objectives_objective_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects_objectives
    ADD CONSTRAINT projects_objectives_objective_id_fkey FOREIGN KEY (objective_id) REFERENCES public.objectives(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: projects_objectives projects_objectives_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects_objectives
    ADD CONSTRAINT projects_objectives_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: projects_persons projects_persons_person_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects_persons
    ADD CONSTRAINT projects_persons_person_id_fkey FOREIGN KEY (person_id) REFERENCES public.people(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: projects_persons projects_persons_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects_persons
    ADD CONSTRAINT projects_persons_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: requirement_activity requirement_activity_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.requirement_activity
    ADD CONSTRAINT requirement_activity_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: requirement_activity requirement_activity_requirement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.requirement_activity
    ADD CONSTRAINT requirement_activity_requirement_id_fkey FOREIGN KEY (requirement_id) REFERENCES public.requirements(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: requirement_mail_threads requirement_mail_threads_requirement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.requirement_mail_threads
    ADD CONSTRAINT requirement_mail_threads_requirement_id_fkey FOREIGN KEY (requirement_id) REFERENCES public.requirements(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: requirement_subscriptors requirement_subscriptors_requirement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.requirement_subscriptors
    ADD CONSTRAINT requirement_subscriptors_requirement_id_fkey FOREIGN KEY (requirement_id) REFERENCES public.requirements(id) ON DELETE CASCADE;


--
-- Name: requirement_subscriptors requirement_subscriptors_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.requirement_subscriptors
    ADD CONSTRAINT requirement_subscriptors_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: requirements requirements_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.requirements
    ADD CONSTRAINT requirements_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: requirements requirements_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.requirements
    ADD CONSTRAINT requirements_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: resources resources_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resources
    ADD CONSTRAINT resources_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: stages stages_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stages
    ADD CONSTRAINT stages_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: unworked_times unworked_times_person_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unworked_times
    ADD CONSTRAINT unworked_times_person_id_fkey FOREIGN KEY (person_id) REFERENCES public.people(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: user_project_permissions user_project_permissions_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_project_permissions
    ADD CONSTRAINT user_project_permissions_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: user_project_permissions user_project_permissions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_project_permissions
    ADD CONSTRAINT user_project_permissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: week_assigned_times week_assigned_times_person_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.week_assigned_times
    ADD CONSTRAINT week_assigned_times_person_id_fkey FOREIGN KEY (person_id) REFERENCES public.people(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: week_assigned_times week_assigned_times_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.week_assigned_times
    ADD CONSTRAINT week_assigned_times_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: worked_times worked_times_objective_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.worked_times
    ADD CONSTRAINT worked_times_objective_id_fkey FOREIGN KEY (objective_id) REFERENCES public.objectives(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: worked_times worked_times_person_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.worked_times
    ADD CONSTRAINT worked_times_person_id_fkey FOREIGN KEY (person_id) REFERENCES public.people(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: worked_times worked_times_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.worked_times
    ADD CONSTRAINT worked_times_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: worked_times worked_times_requirement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.worked_times
    ADD CONSTRAINT worked_times_requirement_id_fkey FOREIGN KEY (requirement_id) REFERENCES public.requirements(id) ON DELETE SET NULL;


--
-- Name: worked_times worked_times_stage_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.worked_times
    ADD CONSTRAINT worked_times_stage_id_fkey FOREIGN KEY (stage_id) REFERENCES public.stages(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

