import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsDateString,
  IsIn,
  IsArray,
  IsUUID,
} from 'class-validator';

export type ApiTokenType = 'mcp' | 'api' | 'both';
export type ApiTokenSpaceScope = 'all' | 'selected';

export class CreateApiTokenDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  permissions?: Record<string, boolean>;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

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
