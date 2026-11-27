import { NextFunction, Request, Response } from 'express';
import { RequirementVisibilityLevel } from '@jiku/models';

/**
 * Corta el acceso a un requisito `internal` desde la superficie `/api/opus/*`.
 *
 * El recorte es de LA SUPERFICIE, no del rol: se aplica igual a `user`, `admin` y
 * `external-user`. Que un usuario interno vea todo por el bus es una decisión explícita
 * (S-023 CA-15), pero el portal es la pantalla que se comparte con el cliente, y la
 * visibilidad es una propiedad del recurso, no del caller. Es el mismo criterio que ya
 * aplicaba `loadPublicActivity` sobre los comentarios, que tampoco mira el rol.
 *
 * Responde **404 `requirement_not_found`**, idéntico al de un id inexistente, siguiendo
 * S-023 CA-14: distinguir "no existe" de "no lo podés ver" le confirma al usuario externo
 * que el recurso existe.
 *
 * Va DESPUÉS de `validateRequirement`, que es quien deja `req.requirement`.
 */
export default function validateRequirementIsPublic(req: Request, res: Response, next: NextFunction) {
  if (req.requirement.visibilityLevel !== RequirementVisibilityLevel.Public) {
    return res.status(404).json({
      code: 'requirement_not_found',
      message: 'Requirement not found',
    });
  }
  return next();
}
