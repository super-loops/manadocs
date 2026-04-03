import {
  IsString,
  IsOptional,
  IsDateString,
  IsIn,
  IsArray,
  IsUUID,
} from 'class-validator';
import {
  ApiTokenType,
  ApiTokenSpaceScope,
} from './create-api-token.dto';

export class UpdateApiTokenDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  permissions?: Record<string, boolean>;

  @IsOptional()
  @IsDateString()
  expiresAt?: string | null;

  @IsOptional()
  @IsString()
  @IsIn(['mcp', 'api', 'both'])
  tokenType?: ApiTokenType;

  @IsOptional()
  @IsString()
  @IsIn(['all', 'selected'])
  spaceScope?: ApiTokenSpaceScope;

  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  spaceIds?: string[];
}
