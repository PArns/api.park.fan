import { IsString, IsNumber, IsOptional } from 'class-validator';

export class ParkQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  continent?: string;

  @IsOptional()
  @IsNumber()
  parkGroupId?: number;

  @IsOptional()
  @IsNumber()
  page?: number;

  @IsOptional()
  @IsNumber()
  limit?: number;
}